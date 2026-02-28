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
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Redo,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react';
import { ActionIcon, Box, Group, Tooltip } from '@mantine/core';
import './writing-editor.css';

interface WritingEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  onTextChange?: (text: string) => void;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon, label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip label={label} position="top" withArrow openDelay={400}>
      <ActionIcon
        variant={isActive ? 'filled' : 'subtle'}
        color={isActive ? 'indigo' : 'gray'}
        size={30}
        radius="sm"
        onClick={onClick}
        aria-label={label}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <div className="toolbar-divider" />;
}

export function WritingEditor({
  content = '',
  placeholder = 'Start writing...',
  onChange,
  onTextChange,
}: WritingEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
      onTextChange?.(ed.getText());
    },
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
  });

  if (!editor) return null;

  const iconSize = 15;
  const iconStroke = 2;

  return (
    <Box
      className="writing-editor"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-md)',
        overflow: 'hidden',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      {/* Toolbar */}
      <Group
        gap={2}
        px="xs"
        py={6}
        wrap="wrap"
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
        }}
      >
        <ToolbarButton
          icon={<Bold size={iconSize} strokeWidth={iconStroke} />}
          label="Bold"
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={<Italic size={iconSize} strokeWidth={iconStroke} />}
          label="Italic"
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={<UnderlineIcon size={iconSize} strokeWidth={iconStroke} />}
          label="Underline"
          isActive={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          icon={<Highlighter size={iconSize} strokeWidth={iconStroke} />}
          label="Highlight"
          isActive={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        />

        <ToolbarDivider />

        <ToolbarButton
          icon={<Heading1 size={iconSize} strokeWidth={iconStroke} />}
          label="Heading 1"
          isActive={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          icon={<Heading2 size={iconSize} strokeWidth={iconStroke} />}
          label="Heading 2"
          isActive={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          icon={<Heading3 size={iconSize} strokeWidth={iconStroke} />}
          label="Heading 3"
          isActive={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />

        <ToolbarDivider />

        <ToolbarButton
          icon={<List size={iconSize} strokeWidth={iconStroke} />}
          label="Bullet List"
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={<ListOrdered size={iconSize} strokeWidth={iconStroke} />}
          label="Ordered List"
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <ToolbarDivider />

        <ToolbarButton
          icon={<AlignLeft size={iconSize} strokeWidth={iconStroke} />}
          label="Align Left"
          isActive={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        />
        <ToolbarButton
          icon={<AlignCenter size={iconSize} strokeWidth={iconStroke} />}
          label="Align Center"
          isActive={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        />
        <ToolbarButton
          icon={<AlignRight size={iconSize} strokeWidth={iconStroke} />}
          label="Align Right"
          isActive={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        />

        <ToolbarDivider />

        <ToolbarButton
          icon={<Undo size={iconSize} strokeWidth={iconStroke} />}
          label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          icon={<Redo size={iconSize} strokeWidth={iconStroke} />}
          label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        />
      </Group>

      {/* Editor */}
      <EditorContent editor={editor} />
    </Box>
  );
}
