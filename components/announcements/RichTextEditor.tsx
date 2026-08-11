'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { FiBold, FiItalic, FiList, FiLink } from 'react-icons/fi'

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your announcement...',
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: value,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[140px] px-3 py-2 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  })

  if (!editor) return null

  const btnClass = (active: boolean) =>
    `p-2 rounded-lg transition-colors ${
      active
        ? 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300'
        : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
    }`

  return (
    <div className="rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
      <div className="flex items-center gap-1 border-b border-stone-200 dark:border-stone-700 px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive('bold'))}
          aria-label="Bold"
        >
          <FiBold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive('italic'))}
          aria-label="Italic"
        >
          <FiItalic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive('bulletList'))}
          aria-label="Bullet list"
        >
          <FiList className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('Link URL')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          className={btnClass(editor.isActive('link'))}
          aria-label="Link"
        >
          <FiLink className="w-4 h-4" />
        </button>
      </div>
      <EditorContent editor={editor} className="text-stone-900 dark:text-white" placeholder={placeholder} />
    </div>
  )
}
