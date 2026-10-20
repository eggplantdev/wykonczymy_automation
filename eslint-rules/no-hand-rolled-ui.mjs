const PRIMITIVE_PACKAGES = /^(@radix-ui\/|radix-ui$|cmdk$|vaul$)/
const LOADER_ICONS = new Set(['Loader2', 'Loader2Icon', 'LoaderCircle', 'LoaderCircleIcon'])
const STATUS_PALETTE = /\b(text|bg|border|ring|fill|stroke)-(red|green|amber|emerald|yellow|orange)-\d{2,3}\b/
const RAW_DIALOG_WIDTH = /\bsm:max-w-(sm|md|lg|xl|\dxl|\[)/
const DIALOG_SHELLS = new Set(['DialogContent', 'AlertDialogContent', 'FormDialogShell'])
const ERROR_TEXT = /\btext-destructive\b/
const SMALL_TEXT = /\btext-(xs|sm)\b/

// Every string fragment reachable from a className value: literals, template quasis, cn() arguments.
function classStrings(node) {
  if (!node) return []
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' ? [node.value] : []
    case 'TemplateLiteral':
      return [
        ...node.quasis.map((quasi) => quasi.value.cooked ?? ''),
        ...node.expressions.flatMap(classStrings),
      ]
    case 'JSXExpressionContainer':
      return classStrings(node.expression)
    case 'CallExpression':
      return node.arguments.flatMap(classStrings)
    case 'ConditionalExpression':
      return [...classStrings(node.consequent), ...classStrings(node.alternate)]
    case 'LogicalExpression':
      return [...classStrings(node.left), ...classStrings(node.right)]
    case 'ArrayExpression':
      return node.elements.flatMap(classStrings)
    default:
      return []
  }
}

const elementName = (node) => (node.name.type === 'JSXIdentifier' ? node.name.name : null)
const isIntrinsic = (name) => name !== null && /^[a-z]/.test(name)
const attribute = (node, name) =>
  node.attributes.find((attr) => attr.type === 'JSXAttribute' && attr.name.name === name)

/** @type {import('eslint').Rule.RuleModule} */
export const noHandRolledUiRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Flag UI rebuilt outside src/components/ui instead of using the shared primitive.',
    },
    schema: [],
    messages: {
      primitivePackage:
        '`{{source}}` is wrapped in src/components/ui — import the ui/ primitive, or add the missing piece there.',
      toast: 'Toast through toastMessage from @/lib/utils/toast, not react-toastify directly.',
      loader: 'Use GradientSpinner / InlineLoading / BlockLoading from ui/, not a raw lucide loader.',
      statusPalette:
        'Raw status colour `{{match}}` — use the tokens (destructive / warning / chart-green) or a ui/ tone prop.',
      dialogWidth:
        'Raw dialog width `{{match}}` — use the dialog width tokens (sm:max-w-dialog-sm … dialog-3xl).',
      errorText: 'Error text paragraph — use <Description tone="error"> or <FieldError> from ui/.',
      details: '<details> — use Collapsible / CollapsibleSection from ui/.',
      label: '<label> — use Label / FieldLabel / CheckboxRow from ui/.',
      button: '<button className> — use Button / TextButton from ui/.',
      title: 'Native `title` tooltip — use SimpleTooltip / HintTooltip from ui/.',
    },
  },
  create(context) {
    const reportPalette = (node, text) => {
      const match = text.match(STATUS_PALETTE)
      if (match) context.report({ node, messageId: 'statusPalette', data: { match: match[0] } })
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (PRIMITIVE_PACKAGES.test(source)) {
          context.report({ node, messageId: 'primitivePackage', data: { source } })
          return
        }
        for (const specifier of node.specifiers) {
          const imported = specifier.type === 'ImportSpecifier' ? specifier.imported.name : null
          if (source === 'react-toastify' && imported !== 'ToastContainer') {
            context.report({ node: specifier, messageId: 'toast' })
          }
          if (source === 'lucide-react' && LOADER_ICONS.has(imported)) {
            context.report({ node: specifier, messageId: 'loader' })
          }
        }
      },
      Literal(node) {
        if (typeof node.value === 'string') reportPalette(node, node.value)
      },
      TemplateElement(node) {
        reportPalette(node, node.value.cooked ?? '')
      },
      JSXOpeningElement(node) {
        const name = elementName(node)
        const classText = classStrings(attribute(node, 'className')?.value).join(' ')

        if (DIALOG_SHELLS.has(name)) {
          const match = classText.match(RAW_DIALOG_WIDTH)
          if (match) context.report({ node, messageId: 'dialogWidth', data: { match: match[0] } })
        }
        if ((name === 'p' || name === 'span') && ERROR_TEXT.test(classText) && SMALL_TEXT.test(classText)) {
          context.report({ node, messageId: 'errorText' })
        }
        if (name === 'details') context.report({ node, messageId: 'details' })
        if (name === 'label') context.report({ node, messageId: 'label' })
        if (name === 'button' && attribute(node, 'className')) {
          context.report({ node, messageId: 'button' })
        }
        const title = attribute(node, 'title')
        if (title && (isIntrinsic(name) || name === 'Button')) {
          context.report({ node: title, messageId: 'title' })
        }
      },
    }
  },
}
