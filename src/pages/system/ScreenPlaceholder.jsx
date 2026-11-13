import { useLocation } from 'react-router-dom'
import { ArrowLeft, PencilRuler } from 'lucide-react'
import Logo from '../../components/brand/Logo'
import Button from '../../components/ui/Button'
import ThemeToggle from '../../components/ui/ThemeToggle'
import Skeleton from '../../components/ui/Skeleton'
import PageHeader from '../../components/shell/PageHeader'
import styles from './ScreenPlaceholder.module.css'

/** Only the page body remains a placeholder; AppShell supplies navigation and top bar. */
export default function ScreenPlaceholder({ title, section }) {
  const { pathname } = useLocation()
  const withinShell = pathname.startsWith('/app/') || pathname.startsWith('/platform/')
  if (withinShell) return (
    <main className={styles.shellPage}>
      <PageHeader title={title} eyebrow={section} actions={<span className={styles.shellPlaceholder}>Preview layout</span>} />
      <div className={styles.shellMetrics}>{[1, 2, 3].map((item) => <section key={item}>
        <Skeleton width="42%" height="10px" /><Skeleton width="66%" height="23px" /><Skeleton width="36%" height="9px" />
      </section>)}</div>
      <section className={styles.shellTable}><div className={styles.shellTableHeader}><Skeleton width="18%"/><Skeleton width="23%"/></div>
        {[1, 2, 3, 4, 5].map((item) => <div className={styles.shellTableRow} key={item}><Skeleton width="18%" /><Skeleton width="25%" /><Skeleton width="14%" /><Skeleton width="11%" radius="999px" /></div>)}
      </section>
      <p className={styles.shellNote}>Screen content shown as placeholders; the shell is what’s being built.</p>
    </main>
  )
  return (
    <main className={styles.page}>
      <header className={styles.top}><Logo variant="full" height={38} /><ThemeToggle /></header>
      <section className={styles.card}>
        <span className={styles.icon}><PencilRuler size={22} aria-hidden="true" /></span>
        {section ? <p className={styles.section}>{section}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.body}>This screen is being redesigned. Its route, guards and permissions are already in place.</p>
        <code className={`${styles.path} num`}>{pathname}</code>
        <div className={styles.actions}><Button variant="secondary" icon={ArrowLeft} onClick={() => window.history.back()}>Go back</Button></div>
      </section>
    </main>
  )
}
