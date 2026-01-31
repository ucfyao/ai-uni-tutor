'use server';

import { createClient } from "@/lib/supabase/server";
// import { chunkText } from "@/lib/rag/chunking";
import { generateEmbedding } from "@/lib/rag/embedding";
import { Database } from "@/types/database";
import { revalidatePath } from "next/cache";
import { parsePDF } from "@/lib/pdf";

export type UploadState = {
    status: 'idle' | 'success' | 'error';
    message: string;
};

export async function uploadDocument(prevState: UploadState, formData: FormData): Promise<UploadState> {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { status: 'error', message: 'No file provided' };
        }

        if (file.type !== 'application/pdf') {
            return { status: 'error', message: 'Only PDF files are supported currently' };
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { status: 'error', message: 'Unauthorized' };
        }

        // Check for duplicates
        const { data: existingDoc } = await supabase
            .from('documents')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', file.name)
            .single();

        if (existingDoc) {
            return { status: 'error', message: `File "${file.name}" already exists.` };
        }

        const school = formData.get('school') as string;
        const course = formData.get('course') as string;

        // 1. Create Document Entry (Processing)
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .insert({
                user_id: user.id,
                name: file.name,
                status: 'processing',
                metadata: {
                    school: school || 'Unspecified',
                    course: course || 'General'
                }
            })
            .select()
            .single();

        if (docError || !doc) {
            console.error('Error creating document:', docError);
            return { status: 'error', message: 'Failed to initialize document processing' };
        }

        revalidatePath('/knowledge');

        // 2. Parse PDF
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let pdfData;
        try {
            pdfData = await parsePDF(buffer);
        } catch (e) {
            console.error('Error parsing PDF:', e);
            await supabase.from('documents').update({ status: 'error', status_message: 'Failed to parse PDF' }).eq('id', doc.id);
            revalidatePath('/knowledge');
            return { status: 'error', message: 'Failed to parse PDF content' };
        }

        // 3. Chunk Text with Metadata
        const { chunkPages } = await import("@/lib/rag/chunking");
        const chunks = await chunkPages(pdfData.pages);

        // 4. Generate Embeddings & Store Chunks
        const chunksData: Database['public']['Tables']['document_chunks']['Insert'][] = [];
        const BATCH_SIZE = 5;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (chunk) => {
                try {
                    const embedding = await generateEmbedding(chunk.content);
                    chunksData.push({
                        document_id: doc.id,
                        content: chunk.content,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        embedding: embedding as any,
                        metadata: chunk.metadata, // Store page number
                    });
                } catch (err) {
                    console.error('Error generating embedding for chunk:', err);
                    throw err;
                }
            }));
        }

        if (chunksData.length > 0) {
            const { error: chunksError } = await supabase.from('document_chunks').insert(chunksData);
            if (chunksError) {
                console.error('Error inserting chunks:', chunksError);
                await supabase.from('documents').update({ status: 'error', status_message: 'Failed to save chunks' }).eq('id', doc.id);
                revalidatePath('/knowledge');
                return { status: 'error', message: 'Failed to save document chunks' };
            }
        }

        // 5. Update Document Status
        await supabase.from('documents').update({ status: 'ready' }).eq('id', doc.id);

        revalidatePath('/knowledge');
        return { status: 'success', message: 'Document processed successfully' };

    } catch (error) {
        console.error('Upload error:', error);
        return { status: 'error', message: 'Internal server error during upload' };
    }
}

export async function deleteDocument(documentId: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('documents').delete().eq('id', documentId);

    if (error) {
        console.error('Error deleting document:', error);
        throw new Error('Failed to delete document');
    }

    revalidatePath('/knowledge');
}
