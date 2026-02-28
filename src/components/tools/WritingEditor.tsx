'use client';

import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  UnderlineIcon,
  Undo,
} from 'lucide-react';
import { useEffect } from 'react';
import { ActionIcon, Box, Divider, Group, Tooltip } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

function ToolbarButton({
  icon: Icon,
  label,
  action,
  isActive,
}: {
  icon: typeof Bold;
  label: string;
  action: () => void;
  isActive?: boolean;
}) {
  return (
    <Tooltip label={label} position="bottom" withArrow>
      <ActionIcon
        variant={isActive ? 'light' : 'subtle'}
        color={isActive ? 'violet' : 'gray'}
        size="sm"
        onClick={action}
      >
        <Icon size={16} strokeWidth={1.5} />
      </ActionIcon>
    </Tooltip>
  );
}

interface WritingEditorProps {
  onUpdate?: (html: string, text: string) => void;
  initialContent?: string;
  /** When set externally (e.g. file import), replaces the editor content. */
  content?: string;
}

export function WritingEditor({ onUpdate, initialContent, content }: WritingEditorProps) {
  const { t } = useLanguage();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: t.tools.editorPlaceholder }),
    ],
    content: initialContent || '',
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getHTML(), ed.getText());
    },
  });

  // Allow parent to push content into the editor (e.g. after file import)
  useEffect(() => {
    if (editor && content !== undefined) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <Box
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Toolbar */}
      <Group
        gap={2}
        px="xs"
        py={6}
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
        wrap="wrap"
      >
        <ToolbarButton
          icon={Bold}
          label="Bold"
          action={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          action={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
        />
        <ToolbarButton
          icon={UnderlineIcon}
          label="Underline"
          action={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="Strikethrough"
          action={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
        />

        <Divider orientation="vertical" mx={4} />

        <ToolbarButton
          icon={Heading1}
          label="Heading 1"
          action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
        />
        <ToolbarButton
          icon={Heading2}
          label="Heading 2"
          action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
        />
        <ToolbarButton
          icon={Heading3}
          label="Heading 3"
          action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
        />

        <Divider orientation="vertical" mx={4} />

        <ToolbarButton
          icon={List}
          label="Bullet List"
          action={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Ordered List"
          action={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
        />
        <ToolbarButton
          icon={Quote}
          label="Blockquote"
          action={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
        />

        <Divider orientation="vertical" mx={4} />

        <ToolbarButton
          icon={AlignLeft}
          label="Align Left"
          action={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
        />
        <ToolbarButton
          icon={AlignCenter}
          label="Align Center"
          action={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
        />
        <ToolbarButton
          icon={AlignRight}
          label="Align Right"
          action={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
        />

        <Divider orientation="vertical" mx={4} />

        <ToolbarButton
          icon={Undo}
          label="Undo"
          action={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          icon={Redo}
          label="Redo"
          action={() => editor.chain().focus().redo().run()}
        />
      </Group>

      {/* Editor content */}
      <Box
        style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}
        className="writing-editor-content"
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
