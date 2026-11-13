import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, ArrowLeftRight, BarChart3, Bell, Building2, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, CreditCard, Crown, FolderKanban, LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal,
  PackageOpen, PanelLeftClose, PanelLeftOpen, Search, ServerCog, Settings2, ShieldCheck,
  UserRound, UsersRound, X,
} from 'lucide-react'
import Logo from '../../components/brand/Logo'
import ThemeToggle from '../../components/ui/ThemeToggle'
import { lockPageScroll } from '../../components/overlays/scrollLock'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { administrativeNavigation, workspaceNavigation } from '../../config/navigation'
import { hasPermission } from '../../utils/permissions'
import { platformPermission } from '../../utils/platformPermissions'
import { formatDate } from '../../utils/formatters'
import { filterNav } from '../../utils/navigationVisibility'
import PageLoader from '../../components/ui/PageLoader'
import activityService from '../../services/activityService'
import GlobalSearch from '../../components/shell/GlobalSearch'
import styles from './AppShell.module.css'

const COLLAPSE_KEY = 'digitalinvoice-shell-collapsed'
const isActive = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`)

// Exact destinations and labels from the previous platform shell.
const platformNavigation = [
  { label: 'Dashboard', permission: 'platform.dashboard', path: '/platform/dashboard', icon: LayoutDashboard },
  { label: 'Platform Users', permission: 'platform.users.view', path: '/platform/users', icon: UsersRound },
  { label: 'Clients', permission: 'platform.clients.view', path: '/platform/clients', icon: Building2 },
  { label: 'Plans', permission: 'platform.plans.view', path: '/platform/plans', icon: PackageOpen },
  { label: 'Subscriptions', permission: 'platform.subscriptions.view', path: '/platform/subscriptions', icon: CreditCard },
  { label: 'Premium Requests', permission: 'platform.premium_requests.view', path: '/platform/premium-requests', icon: Crown },
  { label: 'FIRS Integration', permission: 'platform.firs.view', path: '/platform/firs-integration', icon: ServerCog },
  { label: 'Revenue', permission: 'platform.revenue.view', path: '/platform/revenue', icon: BarChart3 },
  { label: 'Activity Logs', permission: 'platform.activity.view', path: '/platform/activity', icon: ClipboardList },
  { label: 'Settings', permission: 'platform.settings.view', path: '/platform/settings', icon: Settings2 },
]

function NavigationList({ title, items, collapsed, pathname, expanded, onToggle, onNavigate, onOpenCollapsed }) {
  if (!items.length) return null
  return (
    <section className={styles.navSection} aria-label={title}>
      {!collapsed && <p className={styles.navCaption}>{title}</p>}
      <nav aria-label={`${title} navigation`} className={styles.navList}>
        {items.map((item) => {
          const Icon = item.icon
          const children = item.children || []
          const current = isActive(pathname, item.path) || children.some((child) => isActive(pathname, child.path))
          const opened = Boolean(expanded[item.path])
          if (!children.length) return (
            <NavLink key={item.path} to={item.path} title={collapsed ? item.label : undefined}
              onClick={onNavigate} aria-label={collapsed ? `${item.label}${item.planLocked ? ', plan upgrade required' : ''}` : undefined}
              className={({ isActive: active }) => `${styles.navLink} ${active || current ? styles.active : ''}`}>
              <Icon size={17} aria-hidden="true" /><span className={styles.navLabel}>{item.label}</span>
              {!collapsed && item.planLocked && <LockKeyhole size={13} className={styles.navLock} aria-label="Plan upgrade required" />}
            </NavLink>
          )
          return (
            <div key={item.path} className={`${styles.navGroup} ${current ? styles.groupActive : ''}`}>
              <button type="button" className={`${styles.navLink} ${current ? styles.active : ''}`}
                aria-label={collapsed ? `Open ${item.label} menu` : item.label}
                aria-expanded={collapsed ? undefined : opened}
                aria-controls={collapsed ? undefined : `shell-sub-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => collapsed ? onOpenCollapsed(item.path) : onToggle(item.path)}>
                <Icon size={17} aria-hidden="true" />
                <span className={styles.navLabel}>{item.label}</span>
                {!collapsed && <ChevronDown size={14} className={`${styles.chevron} ${opened ? styles.chevronOpen : ''}`} aria-hidden="true" />}
              </button>
              {!collapsed && <div id={`shell-sub-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={styles.subList} hidden={!opened}>
                {children.map((child) => {
                  const ChildIcon = child.icon
                  return <NavLink key={child.path} to={child.path} onClick={onNavigate}
                    className={`${styles.subLink} ${isActive(pathname, child.path) ? styles.subActive : ''}`}>
                    <ChildIcon size={14} aria-hidden="true" /><span>{child.label}</span>
                    {child.planLocked && <LockKeyhole size={12} className={styles.navLock} aria-label="Plan upgrade required" />}
                  </NavLink>
                })}
              </div>}
              {collapsed && <div className={styles.flyout}>
                <strong>{item.label}</strong>
                {children.map((child) => <NavLink key={child.path} to={child.path} onClick={onNavigate}
                  className={isActive(pathname, child.path) ? styles.flyActive : ''}>{child.label}{child.planLocked && <LockKeyhole size={12} aria-label="Plan upgrade required" />}</NavLink>)}
              </div>}
            </div>
          )
        })}
      </nav>
    </section>
  )
}

function Breadcrumbs({ pathname, sections, platform }) {
  const items = sections.flatMap((section) => section.items)
  const exact = items.find((item) => isActive(pathname, item.path) && !item.children)
  const parent = items.find((item) => item.children?.some((child) => isActive(pathname, child.path)))
  const child = parent?.children?.find((item) => isActive(pathname, item.path))
  const selected = child || exact
  const pieces = pathname.split('/').filter(Boolean)
  const heading = selected?.label || pieces.at(-1)?.replace(/-/g, ' ') || 'Dashboard'
  const root = platform ? '/platform/dashboard' : '/app/dashboard'
  const rootLabel = platform ? 'Platform' : 'Workspace'

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <div className={styles.breadcrumbTrail}>
        <Link to={root}>{rootLabel}</Link>
        {parent && <><ChevronRight size={13} aria-hidden="true" /><span>{parent.label}</span></>}
      </div>
      <strong aria-current="page">{heading}</strong>
    </nav>
  )
}

function Initial({ value, className = '' }) {
  return <span className={`${styles.avatar} ${className}`} aria-hidden="true">{(value || 'D').trim().charAt(0).toUpperCase()}</span>
}

function useOutsideClose(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined
    const pointer = (event) => { if (!ref.current?.contains(event.target)) onClose() }
    const keyboard = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', pointer)
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', keyboard) }
  }, [ref, open, onClose])
}

function Shell({ platform = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const organization = useAuthStore((state) => state.organization)
  const permissions = useAuthStore((state) => state.permissions)
  const entitlements = useAuthStore((state) => state.entitlements)
  const platformAccess = useAuthStore((state) => state.platformAccess)
  const logout = useAuthStore((state) => state.logout)
  const showToast = useToastStore((state) => state.showToast)
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem(COLLAPSE_KEY) === 'true' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [salesOpen, setSalesOpen] = useState(false)
  // Submenus start closed; the user's toggle remains in place across page navigation.
  const [expanded, setExpanded] = useState({})
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const accountRef = useRef(null)
  const moreRef = useRef(null)
  const salesRef = useRef(null)
  const sidebarRef = useRef(null)
  const menuTriggerRef = useRef(null)
  const moreTriggerRef = useRef(null)
  const salesTriggerRef = useRef(null)
  const bellRef = useRef(null)
  const closeAccount = useCallback(() => setAccountOpen(false), [])
  const closeBell = useCallback(() => setBellOpen(false), [])
  useOutsideClose(accountRef, accountOpen, closeAccount)
  useOutsideClose(bellRef, bellOpen, closeBell)
  const canViewActivity = !platform && hasPermission(permissions, 'organization.manage')
  const workspaceName = platform ? 'DigitalInvoice Admin' : (organization?.name || 'DigitalInvoice Business')
  // Status is often omitted from the session payload; preserve the prior active default,
  // but never show a green status if the API explicitly marks the workspace inactive.
  const workspaceState = String(organization?.status ?? '').toLowerCase()
  const workspaceActive = platform || (
    !['inactive', 'suspended', 'disabled', 'archived', 'pending'].includes(workspaceState)
    && organization?.is_active !== false && organization?.is_active !== 0
    && organization?.active !== false && organization?.active !== 0
  )

  const sections = useMemo(() => platform ? [{ title: 'Platform', items: platformNavigation.filter((item) => platformPermission(platformAccess, user, item.permission)) }]
    : [
      { title: 'Workspace', items: filterNav(workspaceNavigation, permissions, entitlements, user?.role) },
      { title: 'Administration', items: filterNav(administrativeNavigation, permissions, entitlements, user?.role) },
    ], [platform, permissions, entitlements, platformAccess, user])
  const allItems = sections.flatMap((section) => section.items)
  const salesGroup = allItems.find((item) => item.path === '/app/sales')
  const flatLeaves = allItems.flatMap((item) => item.children || [item])
  const pathname = location.pathname
  const preferred = (path) => flatLeaves.find((item) => isActive(item.path, path))?.path
  const dashboard = platform ? '/platform/dashboard' : preferred('/app/dashboard')
  const sales = preferred('/app/invoices') || flatLeaves.find((item) => item.path.startsWith('/app/') && item.path !== '/app/dashboard')?.path
  const payments = platform ? preferred('/platform/subscriptions') : preferred('/app/payments')
  const reports = platform ? preferred('/platform/revenue') : preferred('/app/reports/invoices')
  const tabs = platform ? [
    { label: 'Dashboard', permission: 'platform.dashboard', path: dashboard, icon: LayoutDashboard },
    { label: 'Clients', permission: 'platform.clients.view', path: preferred('/platform/clients'), icon: Building2 },
    { label: 'Users', path: preferred('/platform/users'), icon: UsersRound },
    { label: 'Revenue', permission: 'platform.revenue.view', path: reports, icon: BarChart3 },
  ] : [
    { label: 'Dashboard', permission: 'platform.dashboard', path: dashboard, icon: LayoutDashboard },
    { label: 'Sales', path: sales, icon: FolderKanban },
    { label: 'Payments', path: payments, icon: CreditCard },
    { label: 'Reports', path: reports, icon: BarChart3 },
  ]

  useEffect(() => { setMobileOpen(false); setMoreOpen(false); setSalesOpen(false); setAccountOpen(false); setBellOpen(false) }, [pathname])
  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, String(collapsed)) } catch { /* storage optional */ }
  }, [collapsed])
  useEffect(() => {
    if (!mobileOpen) return undefined
    const trigger = menuTriggerRef.current
    const releaseScroll = lockPageScroll()
    const focusTimer = requestAnimationFrame(() => sidebarRef.current?.querySelector('a[href], button:not(:disabled)')?.focus())
    const trap = (event) => {
      if (event.key !== 'Tab') return
      const available = [...(sidebarRef.current?.querySelectorAll('a[href], button:not(:disabled)') || [])]
        .filter((node) => getComputedStyle(node).display !== 'none')
      if (!available.length) return
      if (event.shiftKey && document.activeElement === available[0]) { event.preventDefault(); available[available.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === available[available.length - 1]) { event.preventDefault(); available[0].focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { cancelAnimationFrame(focusTimer); document.removeEventListener('keydown', trap); releaseScroll(); trigger?.focus() }
  }, [mobileOpen])
  useEffect(() => {
    if (!salesOpen) return undefined
    const releaseScroll = lockPageScroll()
    const trigger = salesTriggerRef.current
    const focusTimer = requestAnimationFrame(() => salesRef.current?.querySelector('button, a[href]')?.focus())
    const trap = (event) => {
      if (event.key === 'Escape') { setSalesOpen(false); return }
      if (event.key !== 'Tab') return
      const available = [...(salesRef.current?.querySelectorAll('a[href], button:not(:disabled)') || [])]
      if (!available.length) return
      if (event.shiftKey && document.activeElement === available[0]) { event.preventDefault(); available[available.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === available[available.length - 1]) { event.preventDefault(); available[0].focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { cancelAnimationFrame(focusTimer); document.removeEventListener('keydown', trap); releaseScroll(); trigger?.focus() }
  }, [salesOpen])
  useEffect(() => {
    if (!moreOpen) return undefined
    const releaseScroll = lockPageScroll()
    const trigger = moreTriggerRef.current
    const focusTimer = requestAnimationFrame(() => moreRef.current?.querySelector('button, a[href]')?.focus())
    const trap = (event) => {
      if (event.key !== 'Tab') return
      const available = [...(moreRef.current?.querySelectorAll('a[href], button:not(:disabled)') || [])]
      if (!available.length) return
      const first = available[0], last = available[available.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { cancelAnimationFrame(focusTimer); document.removeEventListener('keydown', trap); releaseScroll(); trigger?.focus() }
  }, [moreOpen])
  useEffect(() => {
    const keyboard = (event) => {
      const target = event.target
      const typing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)
      if (((event.key === '/' && !typing && !event.altKey && !event.ctrlKey && !event.metaKey) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'))) {
        event.preventDefault(); setSearchOpen(true)
      }
      if (event.key === 'Escape') { setMobileOpen(false); setMoreOpen(false); setSalesOpen(false) }
    }
    document.addEventListener('keydown', keyboard)
    return () => document.removeEventListener('keydown', keyboard)
  }, [])
  useEffect(() => {
    if (!bellOpen || !canViewActivity) return undefined
    let alive = true
    setActivityLoading(true)
    activityService.list({ limit: 6 }).then((response) => {
      if (alive) setActivity(response.data?.data?.activities || [])
    }).catch(() => { if (alive) setActivity([]) }).finally(() => { if (alive) setActivityLoading(false) })
    return () => { alive = false }
  }, [bellOpen, canViewActivity])
  const handleLogout = async () => {
    setLoggingOut(true)
    try { await logout(); showToast('You have been signed out securely.', 'success', 'Signed out'); navigate('/login', { replace: true }) }
    finally { setLoggingOut(false); setAccountOpen(false) }
  }
  const handleWorkspaceSwitch = () => {
    if (user?.role === 'platform_admin' || organization?.slug === 'digitalinvoice-platform') {
      showToast('This admin account is platform-only. Use Clients to inspect a client workspace, or sign in with a client account to enter the client workspace.', 'info', 'Platform-only account')
      return
    }
    navigate('/app/dashboard')
  }
  const toggleGroup = (path) => setExpanded((state) => ({ ...state, [path]: !state[path] }))
  const openCollapsedGroup = (path) => { setCollapsed(false); setExpanded((state) => ({ ...state, [path]: true })) }
  const groupActive = allItems.find((item) => item.children?.some((child) => isActive(pathname, child.path)))
  const navSections = (isCollapsed, close) => sections.map((section) =>
    <NavigationList key={section.title} title={section.title} items={section.items} collapsed={isCollapsed}
      pathname={pathname} expanded={expanded}
      onToggle={toggleGroup} onOpenCollapsed={openCollapsedGroup} onNavigate={close} />)

  return (
    <div className={`${styles.frame} ${collapsed ? styles.railMode : ''}`}>
      {mobileOpen && <button type="button" aria-label="Close navigation" className={styles.mobileShade} onClick={() => setMobileOpen(false)} />}
      <aside ref={sidebarRef} className={`${styles.sidebar} ${mobileOpen ? styles.mobileVisible : ''}`} aria-label={platform ? 'Platform navigation' : 'Workspace navigation'}>
        <div className={styles.sidebarBrand}>
          <Link to={platform ? '/platform/dashboard' : '/app/dashboard'} onClick={() => setMobileOpen(false)} aria-label="DigitalInvoice home">
            <span className={styles.brandFull}><Logo tone="on-dark" variant="full" height={33} /></span>
            <span className={styles.brandIcon}><Logo variant="icon" height={29} /></span>
          </Link>
          <button className={styles.collapseButton} type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className={styles.mobileSideClose} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18}/></button>
        </div>
        <div className={styles.sideScroll}>
          {navSections(collapsed && !mobileOpen, () => setMobileOpen(false))}
        </div>
        <div className={styles.workspaceDock} aria-label="Current workspace">
          <p className={styles.dockCaption}>CURRENT WORKSPACE</p>
          <div className={styles.orgCard} tabIndex={0}
            title={`${workspaceName} — ${workspaceActive ? 'Active' : 'Inactive'}`}
            aria-label={`Current workspace: ${workspaceName}, ${workspaceActive ? 'active' : 'inactive'}`}>
            <span className={styles.orgName}>{workspaceName}</span>
            <span className={`${styles.workspaceDot} ${workspaceActive ? styles.workspaceDotActive : styles.workspaceDotInactive}`}
              aria-hidden="true" />
          </div>
        </div>
        <button type="button" className={styles.railFooter} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}<span>{collapsed ? '' : 'Collapse menu'}</span>
        </button>
      </aside>

      <div className={styles.sheet}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}>
            <button ref={menuTriggerRef} className={styles.iconButton} type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19}/></button>
            <Link to={dashboard || (platform ? '/platform/dashboard' : '/app/dashboard')}><Logo variant="full" height={32} /></Link>
          </div>
          <Breadcrumbs pathname={pathname} sections={sections} platform={platform} />
          <div className={styles.topbarActions}>
            <button className={`${styles.searchTrigger}`} type="button" aria-label="Search workspace" onClick={() => setSearchOpen(true)}>
              <Search size={17}/><span>{platform ? 'Search clients, subscriptions, users...' : 'Search invoices, customers, payments...'}</span><kbd>Ctrl K</kbd>
            </button>
            <button className={`${styles.iconButton} ${styles.mobileSearch}`} type="button" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={19}/></button>
            <div className={styles.popupAnchor} ref={bellRef}>
              <button className={styles.iconButton} type="button" aria-label="Notifications" aria-expanded={bellOpen} aria-haspopup="true" onClick={() => { setAccountOpen(false); setBellOpen((value) => !value) }}>
                <Bell size={18} />{activity.length > 0 && <span className={styles.notificationDot} />}
              </button>
              {bellOpen && <section className={`${styles.popup} ${styles.notificationPopup} fx-pop`} aria-label="Notifications">
                <div className={styles.popupHeading}><strong>Workspace activity</strong><small>Latest audit events</small></div>
                {!canViewActivity ? <p className={styles.empty}>Notifications will appear here when available.</p>
                  : activityLoading ? <p className={styles.empty}>Loading recent activity…</p>
                    : activity.length ? activity.map((item) => <article className={styles.activityItem} key={item.id}>
                      <Activity size={15} aria-hidden="true"/><div><strong>{item.description}</strong><small>{formatDate(item.created_at, { hour: '2-digit', minute: '2-digit' })}</small></div>
                    </article>) : <p className={styles.empty}>No recent workspace activity yet.</p>}
                {canViewActivity && Boolean(entitlements?.features?.activity_log) && <Link className={styles.popupFooter} to="/app/activity-log" onClick={closeBell}>View activity log</Link>}
              </section>}
            </div>
            <ThemeToggle className={styles.headerThemeToggle} />
            <div className={styles.popupAnchor} ref={accountRef}>
              <button type="button" className={styles.accountButton} aria-label="Open account menu" aria-expanded={accountOpen} aria-haspopup="true" onClick={() => { setBellOpen(false); setAccountOpen((value) => !value) }}>
                <Initial value={user?.name} /><span className={styles.accountText}><strong>{user?.name || 'DigitalInvoice User'}</strong><small>{user?.role?.replaceAll('_', ' ') || 'Member'}</small></span><ChevronDown size={14} aria-hidden="true" />
              </button>
              {accountOpen && <div className={`${styles.popup} ${styles.accountPopup} fx-pop`} role="menu">
                <div className={styles.accountIdentity}><Initial value={user?.name}/><span><strong>{user?.name || 'DigitalInvoice User'}</strong><small>{user?.email || 'Secure account'}</small></span></div>
                <div className={styles.secureAccount}><ShieldCheck size={14} aria-hidden="true"/> Secure account</div>
                <Link role="menuitem" to={platform ? '/platform/profile' : '/app/profile'} onClick={closeAccount}><UserRound size={16}/>Profile</Link>
                {!platform && hasPermission(permissions, 'organization.manage') && Boolean(entitlements?.features?.organization_settings) && <Link role="menuitem" to="/app/settings/organization" onClick={closeAccount}><Settings2 size={16}/>Organisation settings</Link>}
                {!platform && (platformAccess?.can_access_platform || user?.role === 'platform_admin') && <Link role="menuitem" to="/platform/dashboard" onClick={closeAccount}><ShieldCheck size={16}/>Platform console</Link>}
                {platform && <button type="button" role="menuitem" onClick={handleWorkspaceSwitch}><ArrowLeftRight size={16}/>Client workspace</button>}
                <button role="menuitem" className={styles.logout} type="button" disabled={loggingOut} onClick={handleLogout}><LogOut size={16}/>{loggingOut ? 'Signing out…' : 'Sign out securely'}</button>
              </div>}
            </div>
          </div>
        </header>
        <div className={styles.content} key={pathname}>
          <Suspense fallback={<div className={styles.routeFallback}><PageLoader inline message="Opening page…" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </div>

      <nav className={styles.bottomTabs} aria-label="Mobile primary navigation">
        {tabs.filter((tab) => tab.path).map(({ label, path, icon: Icon }) =>
          label === 'Sales' && !platform && salesGroup?.children?.length ?
            <button key={label} ref={salesTriggerRef} type="button" aria-label="Open Sales navigation"
              aria-expanded={salesOpen} className={salesOpen || groupActive?.label === 'Sales' ? styles.tabActive : ''}
              onClick={() => { setMoreOpen(false); setSalesOpen(true) }}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
            </button> :
            <Link key={label} to={path} className={isActive(pathname, path) || (label === 'Reports' && pathname.startsWith('/app/reports')) ? styles.tabActive : ''}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
            </Link>)}
        <button ref={moreTriggerRef} type="button" className={moreOpen ? styles.tabActive : ''} aria-label="More navigation" aria-expanded={moreOpen} onClick={() => { setSalesOpen(false); setMoreOpen(true) }}><MoreHorizontal size={19}/><span>More</span></button>
      </nav>
      {salesOpen && salesGroup?.children?.length > 0 && <div className={styles.mobileMoreLayer}>
        <button aria-label="Close Sales menu" type="button" className={styles.moreShade} onClick={() => setSalesOpen(false)}/>
        <section ref={salesRef} className={`${styles.moreSheet} fx-enter`} role="dialog" aria-modal="true" aria-label="Sales navigation">
          <div className={styles.moreHeader}><strong>Sales documents &amp; customers</strong>
            <button type="button" aria-label="Close Sales menu" onClick={() => setSalesOpen(false)}><X size={19}/></button></div>
          <NavigationList title="Sales" items={salesGroup.children} collapsed={false} pathname={pathname}
            expanded={{}} onToggle={() => {}} onOpenCollapsed={() => {}} onNavigate={() => setSalesOpen(false)} />
        </section>
      </div>}
      {moreOpen && <div className={styles.mobileMoreLayer}>
        <button aria-label="Close more menu" type="button" className={styles.moreShade} onClick={() => setMoreOpen(false)}/>
        <section ref={moreRef} className={`${styles.moreSheet} fx-enter`} role="dialog" aria-modal="true" aria-label="More navigation">
          <div className={styles.moreHeader}><strong>Explore {platform ? 'platform' : 'workspace'}</strong><button type="button" aria-label="Close more menu" onClick={() => setMoreOpen(false)}><X size={19}/></button></div>
          {navSections(false, () => setMoreOpen(false))}
          <Link className={styles.moreProfile} to={platform ? '/platform/profile' : '/app/profile'} onClick={() => setMoreOpen(false)}><UserRound size={17}/> My profile</Link>
        </section>
      </div>}
      <GlobalSearch open={searchOpen} scope={platform ? 'platform' : 'workspace'} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

export default function AppShell() { return <Shell /> }
export function PlatformShell() { return <Shell platform /> }
