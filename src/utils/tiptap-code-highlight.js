import { Node, mergeAttributes } from '@tiptap/core'

export const CodeHighlight = Node.create({
  name: 'codeHighlight',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,

  addAttributes() {
    return {
      language: {
        default: 'javascript',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'code-highlight',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['code-highlight', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      // Create the container
      const dom = document.createElement('div')
      dom.classList.add('card', 'mb-3', 'border-primary')
      dom.contentEditable = 'false'

      // Create the Toolbar (Language Selector)
      const toolbar = document.createElement('div')
      toolbar.className = 'card-header d-flex justify-content-between align-items-center'
      
      const select = document.createElement('select')
      select.className = 'form-select form-select-sm w-auto'
      const languages = ['javascript', 'html', 'css', 'json', 'bash', 'yaml', 'markdown']
      
      languages.forEach(lang => {
        const option = document.createElement('option')
        option.value = lang
        option.innerText = lang.toUpperCase()
        if (lang === node.attrs.language) option.selected = true
        select.appendChild(option)
      })

      select.addEventListener('change', (e) => {
        if (typeof getPos === 'function') {
          editor.view.dispatch(editor.view.state.tr.setNodeMarkup(getPos(), undefined, {
            ...node.attrs,
            // @ts-ignore
            language: e.target.value,
          }))
        }
      })

      toolbar.appendChild(document.createTextNode('Code Highlight'))
      toolbar.appendChild(select)

      // Create the Content Area (The actual text editor part)
      const content = document.createElement('pre')
      content.className = 'card-body p-0 m-0'
      
      // contentDOM is where Tiptap will actually put the text
      const contentDOM = document.createElement('code')
      contentDOM.style.display = 'block'
      contentDOM.style.minHeight = '100px'
      contentDOM.style.padding = '1rem'
      contentDOM.style.outline = 'none'
      contentDOM.contentEditable = 'true'

      content.appendChild(contentDOM)
      dom.appendChild(toolbar)
      dom.appendChild(content)

      return {
        dom,
        contentDOM,
      }
    }
  },
})
