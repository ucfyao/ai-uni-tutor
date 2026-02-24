import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking recent Exam Papers...');
  const { data: exams, error: examError } = await supabase
    .from('exam_papers')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (examError) console.error('Exam Error:', examError);

  if (exams) {
    for (const exam of exams) {
      const { count } = await supabase
        .from('exam_questions')
        .select('*', { count: 'exact', head: true })
        .eq('paper_id', exam.id);
      console.log(`Exam: ${exam.title} (ID: ${exam.id}) - Questions count: ${count}`);
    }
  }

  console.log('\nChecking recent Assignments...');
  const { data: assignments, error: assignError } = await supabase
    .from('assignments')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (assignError) console.error('Assignment Error:', assignError);

  if (assignments) {
    for (const assignment of assignments) {
      const { count } = await supabase
        .from('assignment_items')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_id', assignment.id);
      console.log(`Assignment: ${assignment.title} (ID: ${assignment.id}) - Items count: ${count}`);

      if (count && count > 0) {
        const { data: sampleItem } = await supabase
          .from('assignment_items')
          .select('content, order_num')
          .eq('assignment_id', assignment.id)
          .limit(1)
          .single();
        if (sampleItem) {
          console.log(
            `  Sample item ${sampleItem.order_num}: ${sampleItem.content.substring(0, 50)}...`,
          );
        }
      }
    }
  }
}

main().catch(console.error);
