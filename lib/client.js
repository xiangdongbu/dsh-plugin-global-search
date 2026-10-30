/**
 * dsh-plugin-global-search — browser half.
 *
 * Adds a left-sidebar navigation entry ("全局搜索") plus a Cmd+Shift+F
 * shortcut that pops up a Spotlight-style floating search box directly over
 * the interface. Queries go through the app's ordinary `sessions.search`
 * Remote, which the Host half of this package answers with a literal,
 * CJK-friendly substring scan over every visible Session.
 *
 * Choosing a result (Enter or click) opens that Session and then pages its
 * history in until the query is found in the transcript, scrolls the first
 * match into view, paints every match with the CSS Custom Highlight API, and
 * floats a previous/next counter over the conversation.
 *
 * The file is a hand-written module in the same lazy-CJS/ModuleLoader format
 * the Host serves for every compiled client plugin; it requests only `react`
 * from the platform's shared module table.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-global-search',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const h = React.createElement

    const PANEL_ID = 'global-search'
    const NS = 'globalSearch'
    const HIGHLIGHT_NAME = 'dsh-global-search-hit'
    const FIND_HIGHLIGHT_NAME = 'dsh-global-search-find-hit'
    const STYLE_ID = 'dsh-plugin-global-search-style'
    const FLASH_CLASS = 'dsh-gs-flash'
    const MAX_PAGES = 80
    const MAX_FIND_PAGES = 40
    const MAX_RANGES = 400
    const SEARCH_DEBOUNCE_MS = 180
    const SEARCH_INPUT_ATTR = 'data-dsh-global-search-input'

    const zh = {
      'panel': '全局搜索',
      'title': '全局会话搜索',
      'subtitle': '在所有会话的消息里查找内容',
      'placeholder': '搜索所有会话内容…',
      'hint': '↑↓ 选择 · ↵ 跳转并高亮 · Esc 清空',
      'shortcut': '⌘⇧F',
      'idle': '输入关键词，搜索全部会话的对话内容',
      'loading': '正在搜索…',
      'ready': '{n} 个会话命中',
      'readyMore': '显示前 {n} 个会话，可继续缩小范围',
      'empty': '没有找到包含 “{q}” 的会话',
      'error': '搜索失败：{msg}',
      'sessionFallback': '未命名会话',
      'open': '打开会话并定位',
      'matchIn': '匹配于',
      'prev': '上一个',
      'next': '下一个',
      'close': '关闭并清除高亮',
      'noMatch': '无命中',
      'navigatorLabel': '搜索命中导航',
      'findLabel': '在对话内查找',
      'findPlaceholder': '在本对话中查找…',
      'findPrev': '上一个匹配',
      'findNext': '下一个匹配',
      'findClose': '关闭查找并清除高亮',
      'findNoSession': '当前没有打开的对话',
    }
    const en = {
      'panel': 'Global Search',
      'title': 'Global session search',
      'subtitle': 'Find text across every session',
      'placeholder': 'Search all session content…',
      'hint': '↑↓ select · ↵ jump + highlight · Esc clear',
      'shortcut': '⌘⇧F',
      'idle': 'Type a keyword to search every session',
      'loading': 'Searching…',
      'ready': '{n} matching sessions',
      'readyMore': 'Showing the first {n} sessions; narrow your query',
      'empty': 'No session contains “{q}”',
      'error': 'Search failed: {msg}',
      'sessionFallback': 'Untitled session',
      'open': 'Open session and reveal',
      'matchIn': 'matched in',
      'prev': 'Prev',
      'next': 'Next',
      'close': 'Close and clear highlights',
      'noMatch': 'No matches',
      'navigatorLabel': 'Search match navigation',
      'findLabel': 'Find in conversation',
      'findPlaceholder': 'Find in this conversation…',
      'findPrev': 'Previous match',
      'findNext': 'Next match',
      'findClose': 'Close find and clear highlights',
      'findNoSession': 'No conversation is open',
    }

    const CSS_TEXT = `
.dsh-gs-page {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-base, transparent);
  font-family: inherit;
}
.dsh-gs-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 22px 26px 12px;
}
.dsh-gs-heading { font-size: 17px; font-weight: 600; letter-spacing: .01em; }
.dsh-gs-sub { font-size: 12px; color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.9)); }
.dsh-gs-searchwrap { padding: 0 26px 12px; }
.dsh-gs-box {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28));
  background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,.06));
  transition: border-color .15s ease, box-shadow .15s ease;
}
.dsh-gs-box:focus-within {
  border-color: var(--dsw-alias-border-l3, rgba(127,127,127,.4));
  box-shadow: none;
}
.dsh-gs-box svg { flex: none; color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.9)); }
.dsh-gs-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 14px;
}
.dsh-gs-input::placeholder { color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.8)); }
.dsh-gs-clear {
  flex: none;
  width: 24px; height: 24px;
  border: 0; border-radius: 999px;
  background: transparent; color: var(--dsw-alias-label-tertiary, inherit);
  cursor: pointer; font-size: 15px; line-height: 1;
}
.dsh-gs-clear:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); }
.dsh-gs-kbd {
  flex: none;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28));
  color: var(--dsw-alias-label-tertiary, inherit);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dsh-gs-status {
  padding: 2px 28px 8px;
  min-height: 20px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.9));
}
.dsh-gs-status[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #d64545); }
.dsh-gs-hintline {
  padding: 0 28px 10px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.75));
  letter-spacing: .01em;
}
.dsh-gs-list {
  list-style: none;
  margin: 0;
  padding: 0 16px 24px;
  overflow-y: auto;
  min-height: 0;
  flex: 1 1 auto;
}
.dsh-gs-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 12px;
  margin: 3px 0;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  outline: none;
}
.dsh-gs-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.08)); }
.dsh-gs-row[data-active="true"] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.1));
  border-color: var(--dsw-alias-border-l2, rgba(127,127,127,.25));
}
.dsh-gs-row-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsh-gs-row-title {
  font-size: 13.5px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-gs-row-where {
  margin-left: auto; flex: none;
  max-width: 46%;
  font-size: 11px; color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.9));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left;
}
.dsh-gs-row-snippet {
  font-size: 12.5px; line-height: 1.55;
  color: var(--dsw-alias-label-secondary, rgba(90,90,90,.95));
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  word-break: break-word;
}
.dsh-gs-mark {
  padding: 0 1px;
  border-radius: 3px;
  background: #F78A30;
  color: #1f1f1f;
}
.dsh-gs-empty {
  padding: 40px 30px;
  text-align: center;
  font-size: 13px;
  color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.9));
}
.dsh-gs-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: max(160px, 26vh);
  background: rgba(0, 0, 0, .38);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}
.dsh-gs-modal {
  width: min(680px, calc(100vw - 48px));
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28));
  background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-base, #1f1f24));
  box-shadow: 0 18px 60px rgba(0, 0, 0, .45), 0 2px 8px rgba(0, 0, 0, .2);
}
.dsh-gs-page--overlay { height: auto; max-height: 70vh; background: transparent; }
.dsh-gs-page--overlay .dsh-gs-header { display: none; }
.dsh-gs-page--overlay .dsh-gs-searchwrap { padding: 14px 16px 8px; }
.dsh-gs-page--overlay .dsh-gs-box { height: 44px; }
.dsh-gs-page--overlay .dsh-gs-status { padding: 0 22px 6px; }
.dsh-gs-page--overlay .dsh-gs-hintline { display: none; }
.dsh-gs-page--overlay .dsh-gs-list { padding: 4px 10px 12px; max-height: calc(70vh - 96px); }
::highlight(${HIGHLIGHT_NAME}), ::highlight(${FIND_HIGHLIGHT_NAME}) {
  background-color: #F78A30;
  color: #1a1a1a;
  text-decoration: underline;
  text-decoration-color: #8a4a12;
}
.${FLASH_CLASS} {
  animation: dsh-gs-flash 1.6s ease-out 1;
}
@keyframes dsh-gs-flash {
  0% { outline: 2px solid rgba(247, 138, 48, .95); outline-offset: 4px; border-radius: 8px; }
  100% { outline: 2px solid rgba(247, 138, 48, 0); outline-offset: 4px; border-radius: 8px; }
}
.dsh-gs-nav {
  position: fixed;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(38, 38, 44, .94);
  border: .5px solid rgba(255, 255, 255, .16);
  box-shadow: 0 4px 16px rgba(0, 0, 0, .28);
  color: #f2f2f4;
  font-size: 12px;
  line-height: 1;
  font-family: inherit;
  user-select: none;
}
.dsh-gs-nav-count {
  padding: 0 8px;
  color: rgba(255, 255, 255, .78);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dsh-gs-nav-btn {
  height: 24px; min-width: 24px; padding: 0 8px;
  border: 0; border-radius: 999px;
  background: transparent; color: inherit;
  cursor: pointer; font: inherit; white-space: nowrap;
}
.dsh-gs-nav-btn:hover { background: rgba(255, 255, 255, .14); }
.dsh-gs-nav-btn:focus-visible { outline: 2px solid #7c8cff; outline-offset: 1px; }
.dsh-gs-nav-close { min-width: 24px; padding: 0; font-size: 14px; }
.dsh-gs-findbar {
  position: fixed;
  z-index: 65;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 7px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, rgba(38, 38, 44, .96));
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, .28));
  box-shadow: 0 6px 22px rgba(0, 0, 0, .3);
  color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit;
  font-size: 12px;
  line-height: 1;
}
.dsh-gs-findbar-input {
  width: 170px;
  height: 28px;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12.5px;
}
.dsh-gs-findbar-input::placeholder { color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, .85)); }
.dsh-gs-findbar-count {
  min-width: 40px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary, inherit);
  font-variant-numeric: tabular-nums;
}
.dsh-gs-findbar-btn {
  height: 24px;
  min-width: 24px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.dsh-gs-findbar-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .16)); }
.dsh-gs-findbar-btn:focus-visible { outline: 2px solid #7c8cff; outline-offset: 1px; }
/* Themes such as Catppuccin install a global :focus-visible ring on every
   element. Keep the inline search fields borderless; the surrounding bar
   communicates focus with a neutral border instead of the theme accent. */
.dsh-gs-input:focus,
.dsh-gs-input:focus-visible,
.dsh-gs-findbar-input:focus,
.dsh-gs-findbar-input:focus-visible {
  outline: none !important;
  box-shadow: none !important;
  border-color: transparent !important;
  border-radius: 0 !important;
}
.dsh-gs-findbar:focus-within {
  border-color: var(--dsw-alias-border-l3, rgba(127, 127, 127, .35));
}
`

    // ---- module-scope UI state shared with the (session-scoped) reveal code ----

    let moduleDisposed = false
    let pendingFocus = false
    let matchNavigator = null
    let conversationFind = null
    const focusSinks = new Set()

    /**
     * Spotlight-style overlay visibility, shared between the shortcut (outside
     * React) and the overlay slot component. Kept module-scope so opening,
     * closing and reopening survive the overlay component's mount cycles.
     */
    const overlayStore = {
      open: false,
      listeners: new Set(),
      setOpen(value) {
        if (this.open === value) return
        this.open = value
        for (const listener of [...this.listeners]) {
          try { listener() } catch { /* a stale listener must not break the shortcut */ }
        }
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
    }

    function useOverlayOpen() {
      const [open, setOpen] = React.useState(overlayStore.open)
      React.useEffect(() => overlayStore.subscribe(() => setOpen(overlayStore.open)), [])
      return open
    }

    function requestSearchFocus() {
      if (focusSinks.size > 0) {
        for (const sink of focusSinks) {
          try { sink() } catch { /* a stale sink must not break the shortcut */ }
        }
        return
      }
      pendingFocus = true
    }

    function closeNavigator() {
      if (matchNavigator === null) return
      const previous = matchNavigator
      matchNavigator = null
      try { previous.close() } catch { /* already gone */ }
    }

    exports.inject = ['slots', 'locale', 'shortcuts', 'sessions', 'layout', 'uiWorkspace']

    /**
     * Client plugin body.
     * @param {import('@deepseek-ai/cordis').Context} ctx
     */
    exports.apply = function apply(ctx) {
      if (typeof document === 'undefined') return
      moduleDisposed = false
      ensureStyle()
      const t = ctx.locale.bind(NS)

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'global-search: dictionaries')

      const openPanel = () => {
        try { ctx.layout.selectPanel(PANEL_ID) } catch { /* registered on the next tick */ }
        setTimeout(requestSearchFocus, 50)
      }

      const openSpotlight = () => {
        if (conversationFind !== null) {
          try { conversationFind.close() } catch { /* already gone */ }
          conversationFind = null
        }
        overlayStore.setOpen(true)
        setTimeout(requestSearchFocus, 50)
      }

      // Cmd+F — open the in-conversation find bar in the conversation's
      // top-right corner. Reuses the same #F78A30 highlight style. A query can
      // be supplied so a global-search hit opens the very same find bar.
      const openConversationFind = (query) => {
        const sessionId = currentSessionId()
        if (sessionId === undefined) return false
        if (conversationFind !== null) {
          if (typeof query === 'string') conversationFind.setQuery(query)
          else conversationFind.focus()
          return true
        }
        // The find bar takes over highlighting in this conversation.
        closeNavigator()
        conversationFind = createConversationFind({
          ctx,
          t,
          sessionId,
          initialQuery: typeof query === 'string' ? query : '',
        })
        return true
      }

      const search = (query, signal) => Promise.resolve(ctx.sessions.search(query, signal)).then((result) => {
        if (result === undefined || result.ok !== true) {
          const message = result !== undefined && result.error !== undefined ? result.error.message : 'search unavailable'
          throw new Error(String(message))
        }
        return result.value
      })

      const openSession = (sessionId) => {
        try { ctx.uiWorkspace.openSession(sessionId) } catch (error) {
          console.warn('global-search: openSession failed', error)
        }
      }

      const revealInSession = (sessionId, query) => { void reveal(sessionId, query) }

      // Cmd+Shift+F — show/hide the Spotlight-style floating search box. This
      // command is bound for macOS Desktop (the requested device).
      ctx.effect(() => ctx.shortcuts.register({
        id: 'global-search.open',
        label: () => t('panel'),
        aliases: ['global search', 'search sessions', 'search all sessions'],
        defaults: {
          'desktop:macos': { code: 'KeyF', modifiers: ['primary', 'shift'] },
        },
        regions: ['page', 'editable', 'terminal'],
        modals: [],
        resolve: () => ({
          status: 'handled',
          run: () => {
            if (overlayStore.open) overlayStore.setOpen(false)
            else openSpotlight()
          },
        }),
      }), 'global-search: shortcut')

      // Cmd+F — find inside the currently open conversation.
      ctx.effect(() => ctx.shortcuts.register({
        id: 'conversation.find',
        label: () => t('findLabel'),
        aliases: ['find in conversation', 'search in conversation'],
        defaults: {
          'desktop:macos': { code: 'KeyF', modifiers: ['primary'] },
        },
        regions: ['page'],
        modals: [],
        resolve: () => {
          if (currentSessionId() === undefined) return { status: 'blocked', reason: t('findNoSession') }
          return { status: 'handled', run: () => { openConversationFind() } }
        },
      }), 'global-search: find shortcut')

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({ search, openSession, revealInSession, openPanel }),
      }, GlobalSearchPage))

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 5,
        locale: NS,
        label: () => t('panel'),
      }, GlobalSearchIcon))

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'global-search-spotlight',
        locale: NS,
        inject: () => ({ search, openSession, revealInSession }),
      }, GlobalSearchSpotlight))

      ctx.effect(() => () => {
        moduleDisposed = true
        overlayStore.setOpen(false)
        if (conversationFind !== null) {
          try { conversationFind.close() } catch { /* already gone */ }
          conversationFind = null
        }
        focusSinks.clear()
        closeNavigator()
        clearHighlights()
        const style = document.getElementById(STYLE_ID)
        if (style !== null) style.remove()
        delete window.__dshGlobalSearch
      }, 'global-search: client cleanup')

      // Manual probe for development: `__dshGlobalSearch.open()` /
      // `__dshGlobalSearch.reveal('合同')`.
      window.__dshGlobalSearch = {
        open: openSpotlight,
        openPanel,
        find: openConversationFind,
        reveal: (query) => {
          const sessionId = currentSessionId()
          if (sessionId !== undefined) revealInSession(sessionId, query)
        },
      }

      /**
       * Open `sessionId` (already requested by the caller), wait for its Chat
       * surface, page history in until the query is present, then paint and
       * scroll to the first match.
       * @param {string} sessionId
       * @param {string} query
       */
      async function reveal(sessionId, query) {
        const needles = normalizeNeedles(query)
        if (needles.length === 0 || moduleDisposed) return

        const binding = await waitFor(() => {
          const candidate = ctx.sessions.binding(sessionId)
          return candidate !== undefined && candidate.session !== undefined ? candidate : undefined
        }, 6000)
        if (binding === undefined || moduleDisposed) return
        const session = binding.session

        await waitFor(() => (session.getSnapshot().openState === 'open' ? true : undefined), 6000)
        if (moduleDisposed) return

        const root = await waitFor(() => findFlowRoot(sessionId), 6000)
        if (root === undefined || moduleDisposed) return

        // Show the exact same find bar as Cmd+F, pre-filled with the global
        // query. Its own loader pages history until the first match is found,
        // highlights every match, scrolls the first one into view, and Enter
        // steps to the next match.
        if (conversationFind !== null) {
          try { conversationFind.close() } catch { /* already gone */ }
          conversationFind = null
        }
        conversationFind = createConversationFind({ ctx, t, sessionId, initialQuery: query })
      }
    }

    // ------------------------------------------------------------------
    // React panel
    // ------------------------------------------------------------------

    /**
     * Shared search experience used by both the docked left-sidebar page and
     * the Spotlight-style floating overlay.
     * @param {Record<string, any>} props
     */
    function SearchExperience(props) {
      const { t, search, openSession, revealInSession, mode = 'page', onClose } = props
      const useSessions = props.useSessions
      const sessionsSnapshot = typeof useSessions === 'function' ? useSessions((snapshot) => snapshot) : undefined

      const [query, setQuery] = React.useState('')
      const [result, setResult] = React.useState({ status: 'idle', items: [], hasMore: false, error: null, q: '' })
      const [active, setActive] = React.useState(0)
      const inputRef = React.useRef(null)
      const listRef = React.useRef(null)

      React.useEffect(() => {
        const sink = () => {
          const input = inputRef.current
          if (input === null) return
          // Every summon starts a fresh query.
          setQuery('')
          try { input.focus({ preventScroll: true }) } catch { try { input.focus() } catch { /* ignore */ } }
          try { input.select() } catch { /* ignore */ }
        }
        focusSinks.add(sink)
        const timer = setTimeout(() => {
          pendingFocus = false
          sink()
        }, 0)
        return () => { clearTimeout(timer); focusSinks.delete(sink) }
      }, [])

      React.useEffect(() => {
        const normalized = query.trim()
        if (normalized === '') {
          setResult({ status: 'idle', items: [], hasMore: false, error: null, q: '' })
          setActive(0)
          return
        }
        const controller = new AbortController()
        setResult((previous) => ({ status: 'loading', items: previous.q === normalized ? previous.items : [], hasMore: false, error: null, q: normalized }))
        const timer = setTimeout(() => {
          Promise.resolve()
            .then(() => search(normalized, controller.signal))
            .then((value) => {
              if (controller.signal.aborted) return
              const items = value !== undefined && Array.isArray(value.items) ? value.items : []
              setResult({ status: 'ready', items, hasMore: value !== undefined && value.hasMore === true, error: null, q: normalized })
              setActive(0)
            })
            .catch((error) => {
              if (controller.signal.aborted) return
              setResult({ status: 'error', items: [], hasMore: false, error: String(error && error.message !== undefined ? error.message : error), q: normalized })
            })
        }, SEARCH_DEBOUNCE_MS)
        return () => { clearTimeout(timer); controller.abort() }
      }, [query, search])

      React.useEffect(() => {
        const container = listRef.current
        if (container === null) return
        const node = container.querySelector(`[data-dsh-gs-index="${String(active)}"]`)
        if (node !== null && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' })
      }, [active, result.items.length])

      const items = result.items
      const openAt = (index) => {
        const item = items[index]
        if (item === undefined) return
        openSession(item.sessionId)
        revealInSession(item.sessionId, query.trim())
        if (mode === 'overlay' && typeof onClose === 'function') onClose()
      }
      const onKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setActive((index) => Math.min(items.length - 1, index + 1))
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setActive((index) => Math.max(0, index - 1))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          openAt(active)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          if (query !== '') setQuery('')
          else if (mode === 'overlay' && typeof onClose === 'function') onClose()
        }
      }

      const statusText = (() => {
        if (result.status === 'error') return t('error', { msg: result.error })
        if (result.status === 'loading') return t('loading')
        if (result.status === 'ready') {
          const count = items.length
          if (count === 0) return t('empty', { q: result.q })
          return result.hasMore ? t('readyMore', { n: count }) : t('ready', { n: count })
        }
        return t('idle')
      })()

      const rows = items.map((item, index) => {
        const summary = sessionsSnapshot !== undefined && sessionsSnapshot.byId !== undefined
          ? sessionsSnapshot.byId[item.sessionId]
          : undefined
        const title = summary !== undefined && summary.displayTitle !== undefined && summary.displayTitle !== ''
          ? summary.displayTitle
          : t('sessionFallback')
        const where = summary !== undefined && summary.cwd !== undefined ? basename(summary.cwd) : ''
        return h('li', {
          key: `${item.sessionId}:${String(index)}`,
          className: 'dsh-gs-row',
          'data-dsh-gs-index': String(index),
          'data-active': index === active ? 'true' : 'false',
          role: 'option',
          'aria-selected': index === active ? 'true' : 'false',
          title: t('open'),
          onMouseMove: () => { if (index !== active) setActive(index) },
          onClick: () => openAt(index),
        },
          h('div', { className: 'dsh-gs-row-top' },
            h('span', { className: 'dsh-gs-row-title' }, title),
            where !== '' ? h('span', { className: 'dsh-gs-row-where', title: summary.cwd }, where) : null,
          ),
          h('div', { className: 'dsh-gs-row-snippet' }, renderSnippet(item.snippet, query)),
        )
      })

      return h('div', { className: mode === 'overlay' ? 'dsh-gs-page dsh-gs-page--overlay' : 'dsh-gs-page' },
        h('div', { className: 'dsh-gs-header' },
          h('div', { className: 'dsh-gs-heading' }, t('title')),
          h('div', { className: 'dsh-gs-sub' }, t('subtitle')),
        ),
        h('div', { className: 'dsh-gs-searchwrap' },
          h('div', { className: 'dsh-gs-box' },
            h(SearchGlyph, { size: 16 }),
            h('input', {
              ref: inputRef,
              className: 'dsh-gs-input',
              type: 'text',
              value: query,
              placeholder: t('placeholder'),
              'aria-label': t('placeholder'),
              [SEARCH_INPUT_ATTR]: 'true',
              spellCheck: false,
              autoComplete: 'off',
              onChange: (event) => setQuery(event.target.value),
              onKeyDown,
            }),
            query !== '' ? h('button', {
              type: 'button',
              className: 'dsh-gs-clear',
              title: t('close'),
              'aria-label': t('close'),
              onClick: () => setQuery(''),
            }, '×') : null,
            h('span', { className: 'dsh-gs-kbd' }, t('shortcut')),
          ),
        ),
        h('div', { className: 'dsh-gs-status', 'data-tone': result.status === 'error' ? 'error' : undefined }, statusText),
        h('div', { className: 'dsh-gs-hintline' }, t('hint')),
        rows.length > 0
          ? h('ul', { ref: listRef, className: 'dsh-gs-list', role: 'listbox', 'aria-label': t('title') }, rows)
          : h('div', { className: 'dsh-gs-empty' }, statusText),
      )
    }

    /**
     * Docked left-sidebar main-page variant of the search experience.
     * @param {Record<string, any>} props
     */
    function GlobalSearchPage(props) {
      return h(SearchExperience, { ...props, mode: 'page' })
    }

    /**
     * Spotlight-style floating search box: a dimmed full-screen backdrop with a
     * rounded, top-centered search card. Renders nothing while closed.
     * @param {Record<string, any>} props
     */
    function GlobalSearchSpotlight(props) {
      const open = useOverlayOpen()
      React.useEffect(() => {
        if (!open) return undefined
        const onKeydown = (event) => {
          if (event.key === 'Escape') overlayStore.setOpen(false)
        }
        document.addEventListener('keydown', onKeydown, true)
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
          document.removeEventListener('keydown', onKeydown, true)
          document.body.style.overflow = previousOverflow
        }
      }, [open])
      if (!open) return null
      const close = () => overlayStore.setOpen(false)
      return h('div', {
        className: 'dsh-gs-overlay',
        role: 'presentation',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) close()
        },
      }, h('div', {
        className: 'dsh-gs-modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': typeof props.t === 'function' ? props.t('title') : 'Global Search',
      }, h(SearchExperience, { ...props, mode: 'overlay', onClose: close })))
    }

    /** Left-sidebar navigation icon. */
    function GlobalSearchIcon({ size }) {
      return h(SearchGlyph, { size: typeof size === 'number' ? size : 18 })
    }

    /** Magnifier glyph used by the panel and the sidebar row. */
    function SearchGlyph({ size }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
      },
        h('circle', { cx: 10.5, cy: 10.5, r: 6.5, stroke: 'currentColor', strokeWidth: 1.8 }),
        h('path', { d: 'M15.4 15.4L21 21', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
      )
    }

    /**
     * Clip a workspace directory path down to its final segment.
     * @param {string} value
     */
    function basename(value) {
      const trimmed = String(value).replace(/[\\/]+$/u, '')
      const at = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
      return at >= 0 ? trimmed.slice(at + 1) : trimmed
    }

    /**
     * Split a snippet into plain text and <mark> nodes for every query term.
     * @param {string | undefined} snippet
     * @param {string} query
     */
    function renderSnippet(snippet, query) {
      const text = String(snippet ?? '')
      if (text === '') return null
      const terms = query.trim().split(/\s+/u).filter((term) => term.length > 0).map(escapeRegExp)
      if (terms.length === 0) return text
      let pattern
      try {
        pattern = new RegExp(`(${terms.join('|')})`, 'giu')
      } catch {
        return text
      }
      const parts = text.split(pattern)
      return parts.map((part, index) => (index % 2 === 1
        ? h('mark', { key: `m${String(index)}`, className: 'dsh-gs-mark' }, part)
        : part))
    }

    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    }

    // ------------------------------------------------------------------
    // DOM helpers: locate the conversation flow, page history, highlight
    // ------------------------------------------------------------------

    function ensureStyle() {
      if (document.getElementById(STYLE_ID) !== null) return
      const tag = document.createElement('style')
      tag.id = STYLE_ID
      tag.dataset.plugin = 'dsh-plugin-global-search'
      tag.textContent = CSS_TEXT
      document.head.appendChild(tag)
    }

    function currentSessionId() {
      const host = document.querySelector('[data-conversation-session]')
      const value = host === null || host === undefined ? null : host.getAttribute('data-conversation-session')
      return value === null || value === undefined || value === '' ? undefined : value
    }

    function findFlowRoot(sessionId) {
      const host = document.querySelector(`[data-conversation-session="${escapeAttribute(sessionId)}"]`)
      if (host === null) return undefined
      const flow = host.querySelector('[data-slot="conversation.chat.flow"]') ?? host.querySelector('[data-chat-flow]')
      return flow ?? undefined
    }

    function normalizeNeedles(query) {
      const trimmed = String(query).trim().toLowerCase()
      if (trimmed === '') return []
      const terms = trimmed.split(/\s+/u).filter((term) => term.length > 0)
      return terms.length === 0 ? [trimmed] : terms
    }

    function collectMatches(root, needles) {
      const ranges = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.nodeValue
          if (text === null || text.length === 0) return NodeFilter.FILTER_REJECT
          const parent = node.parentElement
          if (parent === null) return NodeFilter.FILTER_REJECT
          if (parent.closest('style, script, noscript, textarea, [hidden]') !== null) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        },
      })
      let node = walker.nextNode()
      while (node !== null) {
        const text = node.nodeValue ?? ''
        const lower = text.toLowerCase()
        for (const needle of needles) {
          let from = 0
          for (;;) {
            const at = lower.indexOf(needle, from)
            if (at < 0) break
            const range = document.createRange()
            range.setStart(node, at)
            range.setEnd(node, at + needle.length)
            ranges.push(range)
            from = at + needle.length
            if (ranges.length >= MAX_RANGES) return ranges
          }
        }
        node = walker.nextNode()
      }
      return ranges
    }

    function applyHighlight(ranges, name = HIGHLIGHT_NAME) {
      if (typeof Highlight !== 'function' || typeof CSS === 'undefined' || CSS.highlights === undefined) return
      try {
        CSS.highlights.set(name, new Highlight(...ranges))
      } catch {
        // A range detached by a concurrent re-render simply yields no highlight.
      }
    }

    function clearHighlight(name = HIGHLIGHT_NAME) {
      if (typeof CSS !== 'undefined' && CSS.highlights !== undefined) CSS.highlights.delete(name)
    }

    function clearHighlights() {
      clearHighlight(HIGHLIGHT_NAME)
      clearHighlight(FIND_HIGHLIGHT_NAME)
    }

    function rowOf(range) {
      const parent = range.startContainer.parentElement
      return parent === null ? null : parent.closest('[data-chat-turn], [data-chat-anchor-key]')
    }

    /**
     * Put the first match in the middle of the conversation scrollport. When the
     * match is too close to an end to center (for example the first turn), fall
     * back to aligning it near the top of the viewport. The Chat surface may
     * still settle its tail-follow after history pages render, so re-apply in a
     * short retry loop until the position sticks.
     * @param {Range} range
     */
    async function scrollToRange(range) {
      const scroller = document.querySelector('[data-conversation-scroll]')
      const anchor = range.startContainer.parentElement
      if (anchor === null && scroller === null) return
      const TOP_PADDING = 16
      for (let attempt = 0; attempt < 10; attempt++) {
        if (scroller === null) {
          if (anchor !== null) anchor.scrollIntoView({ block: 'center' })
          await frame()
          await frame()
          continue
        }
        const box = scroller.getBoundingClientRect()
        const rect = range.getBoundingClientRect()
        const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        // Distance from the scrollport top to the matched line at the current scroll.
        const topAt = scroller.scrollTop + (rect.top - box.top)
        const centered = topAt - (box.height - rect.height) / 2
        // Can we center the matched line without crossing a boundary? If not,
        // align it near the top instead.
        const canCenter = centered >= 0 && centered <= maxScroll
        const target = canCenter
          ? centered
          : Math.max(0, Math.min(maxScroll, topAt - TOP_PADDING))
        scroller.scrollTop = target
        await frame()
        await frame()

        // Verify: centered within 3px, or top-aligned within 3px when centering
        // was impossible (including the clamped boundary case).
        const boxAfter = scroller.getBoundingClientRect()
        const rectAfter = range.getBoundingClientRect()
        const offset = rectAfter.top - boxAfter.top
        const centeredOffset = (boxAfter.height - rectAfter.height) / 2
        const centeredOk = Math.abs(offset - centeredOffset) <= 3
        const topOk = Math.abs(offset - TOP_PADDING) <= 3
        if ((canCenter && centeredOk) || (!canCenter && (topOk || Math.abs(scroller.scrollTop - target) < 1))) {
          return
        }
      }
      if (anchor !== null) anchor.scrollIntoView({ block: 'center' })
    }

    function flashRange(range) {
      const row = rowOf(range)
      if (row === null) return
      row.classList.add(FLASH_CLASS)
      setTimeout(() => row.classList.remove(FLASH_CLASS), 2000)
    }

    function frame() {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
        else setTimeout(resolve, 16)
      })
    }

    /**
     * Poll a probe until it returns a defined value.
     * @template T
     * @param {() => T | undefined} read
     * @param {number} timeoutMs
     * @returns {Promise<T | undefined>}
     */
    function waitFor(read, timeoutMs) {
      return new Promise((resolve) => {
        const started = Date.now()
        const step = () => {
          if (moduleDisposed) return resolve(undefined)
          let value
          try { value = read() } catch { value = undefined }
          if (value !== undefined) return resolve(value)
          if (Date.now() - started >= timeoutMs) return resolve(undefined)
          setTimeout(step, 60)
        }
        step()
      })
    }

    function escapeAttribute(value) {
      return String(value).replaceAll('"', '\\"')
    }

    function isChineseUi() {
      return (document.documentElement.lang ?? '').toLowerCase().startsWith('zh')
    }

    /**
     * A compact, persistent find bar anchored to the conversation's top-right
     * corner (Cmd+F). It searches the messages currently in the chat flow,
     * loads older history when the query has no match yet, and paints every
     * match with the same #F78A30 style as the global search.
     * @param {{ ctx: import('@deepseek-ai/cordis').Context, t: (key: string, params?: Record<string, unknown>) => string, sessionId: string }} input
     * @returns {{ focus: () => void, close: () => void }}
     */
    function createConversationFind(input) {
      const { ctx, t, sessionId, initialQuery = '' } = input
      const el = document.createElement('div')
      el.className = 'dsh-gs-findbar'
      el.setAttribute('role', 'search')
      el.setAttribute('aria-label', t('findLabel'))
      const field = document.createElement('input')
      field.type = 'text'
      field.className = 'dsh-gs-findbar-input'
      field.placeholder = t('findPlaceholder')
      field.setAttribute('aria-label', t('findPlaceholder'))
      field.spellcheck = false
      field.autocomplete = 'off'
      const counter = document.createElement('span')
      counter.className = 'dsh-gs-findbar-count'
      counter.textContent = '0/0'
      const prev = createFindButton('↑', t('findPrev'))
      const next = createFindButton('↓', t('findNext'))
      const closeButton = createFindButton('×', t('findClose'))
      el.append(field, counter, prev, next, closeButton)
      document.body.appendChild(el)

      let closed = false
      let composing = false
      let needles = []
      let index = 0
      let total = 0
      let generation = 0
      let debounceTimer = null

      const position = () => {
        const scroller = document.querySelector('[data-conversation-scroll]')
        if (scroller === null) {
          el.style.top = '76px'
          el.style.right = '24px'
          return
        }
        const rect = scroller.getBoundingClientRect()
        el.style.top = `${String(Math.round(rect.top + 12))}px`
        el.style.right = `${String(Math.round(Math.max(12, window.innerWidth - rect.right + 12)))}px`
      }
      const updateCounter = () => {
        counter.textContent = total === 0 ? '0/0' : `${String(index + 1)}/${String(total)}`
      }
      const clearOwnHighlight = () => { clearHighlight(FIND_HIGHLIGHT_NAME) }
      const refresh = async (scrollToActive) => {
        if (closed) return
        const current = ++generation
        const root = findFlowRoot(sessionId)
        if (root === undefined) { total = 0; clearOwnHighlight(); updateCounter(); return }
        let matches = collectMatches(root, needles)
        if (matches.length === 0 && needles.length > 0) {
          const binding = ctx.sessions.binding(sessionId)
          const session = binding !== undefined ? binding.session : undefined
          let pages = 0
          while (matches.length === 0 && session !== undefined && session.getSnapshot().hasMore === true && pages < MAX_FIND_PAGES) {
            if (closed || current !== generation) return
            pages += 1
            try {
              await session.loadOlder()
            } catch {
              break
            }
            await frame()
            await frame()
            matches = collectMatches(findFlowRoot(sessionId) ?? root, needles)
          }
        }
        if (closed || current !== generation) return
        total = matches.length
        if (total === 0) {
          index = 0
          clearOwnHighlight()
          updateCounter()
          return
        }
        index = ((index % total) + total) % total
        applyHighlight(matches, FIND_HIGHLIGHT_NAME)
        updateCounter()
        if (scrollToActive) await scrollToRange(matches[index])
      }
      const applyQuery = (value, immediate) => {
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer)
          debounceTimer = null
        }
        field.value = value
        needles = normalizeNeedles(value)
        index = 0
        if (needles.length === 0) {
          total = 0
          clearOwnHighlight()
          updateCounter()
          return
        }
        if (immediate) void refresh(true)
        else debounceTimer = setTimeout(() => { void refresh(true) }, 180)
      }
      const schedule = () => { applyQuery(field.value, false) }
      const step = async (delta) => {
        if (closed) return
        const root = findFlowRoot(sessionId)
        const matches = root === undefined ? [] : collectMatches(root, needles)
        if (matches.length === 0) {
          await refresh(true)
          field.focus()
          return
        }
        total = matches.length
        index = ((index + delta) % total + total) % total
        applyHighlight(matches, FIND_HIGHLIGHT_NAME)
        updateCounter()
        await scrollToRange(matches[index])
        field.focus()
      }
      const closeSelf = () => {
        if (closed) return
        closed = true
        if (debounceTimer !== null) clearTimeout(debounceTimer)
        field.removeEventListener('input', onInput)
        field.removeEventListener('keydown', onKeydown)
        field.removeEventListener('compositionstart', onCompositionStart)
        field.removeEventListener('compositionend', onCompositionEnd)
        prev.removeEventListener('click', onPrev)
        next.removeEventListener('click', onNext)
        closeButton.removeEventListener('click', closeSelf)
        document.removeEventListener('keydown', onDocumentKeydown, true)
        window.removeEventListener('resize', position)
        clearInterval(sessionWatch)
        clearOwnHighlight()
        el.remove()
        if (conversationFind !== null && conversationFind.close === closeSelf) conversationFind = null
      }
      const onInput = () => { if (!composing) schedule() }
      const onCompositionStart = () => { composing = true }
      const onCompositionEnd = () => { composing = false; schedule() }
      const onKeydown = (event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeSelf(); return }
        if (event.key === 'Enter') { event.preventDefault(); void step(event.shiftKey ? -1 : 1) }
      }
      const onDocumentKeydown = (event) => { if (event.key === 'Escape') closeSelf() }
      const onPrev = () => { void step(-1) }
      const onNext = () => { void step(1) }

      field.addEventListener('input', onInput)
      field.addEventListener('keydown', onKeydown)
      field.addEventListener('compositionstart', onCompositionStart)
      field.addEventListener('compositionend', onCompositionEnd)
      prev.addEventListener('click', onPrev)
      next.addEventListener('click', onNext)
      closeButton.addEventListener('click', closeSelf)
      document.addEventListener('keydown', onDocumentKeydown, true)
      window.addEventListener('resize', position)
      const sessionWatch = setInterval(() => {
        if (closed) return
        if (currentSessionId() !== sessionId) closeSelf()
      }, 800)
      position()
      updateCounter()
      const focus = () => {
        try { field.focus({ preventScroll: true }) } catch { try { field.focus() } catch { /* ignore */ } }
        try { field.select() } catch { /* ignore */ }
      }
      focus()
      if (typeof initialQuery === 'string' && initialQuery.trim() !== '') applyQuery(initialQuery, true)
      return { focus, close: closeSelf, setQuery: (value) => { applyQuery(String(value), true); focus() } }
    }

    function createFindButton(label, title) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'dsh-gs-findbar-btn'
      button.textContent = label
      button.title = title
      button.setAttribute('aria-label', title)
      return button
    }

    /**
     * Floating "n / m 上一个 下一个 ×" navigator over the conversation.
     * Re-collects matches on each step because React re-renders invalidate ranges.
     */
    function createMatchNavigator(input) {
      const t = input.t
      const el = document.createElement('div')
      el.className = 'dsh-gs-nav'
      el.setAttribute('role', 'group')
      el.setAttribute('aria-label', t('navigatorLabel'))
      const counter = document.createElement('span')
      counter.className = 'dsh-gs-nav-count'
      const prev = createNavButton(t('prev'), t('prev'))
      const next = createNavButton(t('next'), t('next'))
      const closeButton = createNavButton('×', t('close'))
      closeButton.classList.add('dsh-gs-nav-close')
      el.append(counter, prev, next, closeButton)
      document.body.appendChild(el)

      let index = 0
      let total = 0
      let closed = false

      const position = () => {
        const scroller = document.querySelector('[data-conversation-scroll]')
        if (scroller === null) {
          el.style.top = '88px'
          el.style.right = '24px'
          return
        }
        const rect = scroller.getBoundingClientRect()
        el.style.top = `${String(Math.round(rect.top + 10))}px`
        el.style.right = `${String(Math.round(Math.max(16, window.innerWidth - rect.right + 16)))}px`
      }
      const updateCounter = () => {
        counter.textContent = total === 0 ? t('noMatch') : `${String(index + 1)} / ${String(total)}`
      }
      const closeSelf = () => {
        if (closed) return
        closed = true
        document.removeEventListener('keydown', onKeydown, true)
        window.removeEventListener('resize', position)
        clearInterval(sessionWatch)
        el.remove()
        clearHighlights()
      }
      const go = async (target) => {
        if (closed) return
        if (currentSessionId() !== input.sessionId) { closeSelf(); return }
        const root = findFlowRoot(input.sessionId)
        const matches = root === undefined ? [] : collectMatches(root, input.needles)
        if (matches.length === 0) { closeSelf(); return }
        total = matches.length
        index = ((target % total) + total) % total
        updateCounter()
        applyHighlight(matches)
        const range = matches[index]
        await scrollToRange(range)
        flashRange(range)
      }
      const onKeydown = (event) => { if (event.key === 'Escape') closeSelf() }
      prev.addEventListener('click', () => { void go(index - 1) })
      next.addEventListener('click', () => { void go(index + 1) })
      closeButton.addEventListener('click', closeSelf)
      document.addEventListener('keydown', onKeydown, true)
      window.addEventListener('resize', position)
      const sessionWatch = setInterval(() => {
        if (closed) return
        if (currentSessionId() !== input.sessionId) closeSelf()
      }, 1000)
      position()
      updateCounter()
      return { go, close: closeSelf }
    }

    function createNavButton(label, title) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'dsh-gs-nav-btn'
      button.textContent = label
      button.title = title
      button.setAttribute('aria-label', title)
      return button
    }

    return module.exports
  },
})
