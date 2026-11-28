import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Clock3, CopyPlus, LayoutList, LogOut, Plus, Trash2, X } from 'lucide-react';
import { createAccount, enablePersistentSession, isFirebaseConfigured, observeAuth, observePlanner, savePlanner, signIn, signInWithGoogle, signOutUser } from './firebase';
import './styles.css';

const STORAGE_KEY = 'dayflow-data-v1';
const pad = (n) => String(n).padStart(2, '0');
const toKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = toKey(new Date());
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const dateLabel = (key, long = false) => new Intl.DateTimeFormat('pl-PL', long
  ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  : { day: 'numeric', month: 'long' }).format(fromKey(key));
const emptyTemplateTask = () => ({ text: '', startTime: '', endTime: '' });
const normalizeTemplateTask = (task) => typeof task === 'string'
  ? { text: task, startTime: '', endTime: '' }
  : { text: task.text || '', startTime: task.startTime || '', endTime: task.endTime || '' };

const initialData = {
  tasks: {
    [todayKey]: [
      { id: uid(), text: 'Zaplanować najważniejsze zadanie dnia', done: false },
      { id: uid(), text: '20 minut ruchu', done: false },
      { id: uid(), text: 'Podsumować dzień', done: false },
    ],
  },
  templates: [
    { id: uid(), name: 'Dobry początek', tasks: [
      { text: 'Przejrzeć plan dnia', startTime: '08:00', endTime: '08:15' },
      { text: '10 minut bez telefonu', startTime: '08:15', endTime: '08:25' },
      { text: 'Ustalić priorytet', startTime: '08:25', endTime: '08:35' },
    ] },
  ],
};

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialData; }
  catch { return initialData; }
}

function App() {
  const [data, setData] = useState(loadData);
  const [user, setUser] = useState(null);
  const [remoteLoaded, setRemoteLoaded] = useState(!isFirebaseConfigured);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [view, setView] = useState('today');
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [newTask, setNewTask] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLines, setTemplateLines] = useState([emptyTemplateTask()]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const applyingRemote = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (isFirebaseConfigured && user && remoteLoaded) {
      if (applyingRemote.current) { applyingRemote.current = false; return; }
      savePlanner(user.uid, data).catch(() => setNotice('Nie udało się zapisać zmian w chmurze'));
    }
  }, [data, user, remoteLoaded]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(t); }, [notice]);
  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    let unsubscribe;
    enablePersistentSession()
      .catch(() => setNotice('Przeglądarka nie pozwoliła zapamiętać logowania'))
      .finally(() => {
        unsubscribe = observeAuth((nextUser) => { setUser(nextUser); setRemoteLoaded(!nextUser); });
      });
    return () => unsubscribe?.();
  }, []);
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return undefined;
    return observePlanner(user.uid, (planner) => {
      if (planner) { applyingRemote.current = true; setData(planner); }
      else { savePlanner(user.uid, loadData()).catch(() => setNotice('Nie udało się utworzyć planera w chmurze')); }
      setRemoteLoaded(true);
    });
  }, [user]);

  const activeDate = view === 'today' ? todayKey : selectedDate;
  const tasks = data.tasks[activeDate] || [];
  const completed = tasks.filter((t) => t.done).length;

  const addTask = (event) => {
    event?.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    const taskStartTime = event?.currentTarget?.elements?.startTime?.value || startTime;
    const taskEndTime = event?.currentTarget?.elements?.endTime?.value || endTime;
    setData((d) => ({ ...d, tasks: { ...d.tasks, [activeDate]: [...(d.tasks[activeDate] || []), { id: uid(), text, done: false, startTime: taskStartTime, endTime: taskEndTime }] } }));
    setNewTask(''); setStartTime(''); setEndTime('');
  };
  const toggleTask = (id) => setData((d) => ({ ...d, tasks: { ...d.tasks, [activeDate]: (d.tasks[activeDate] || []).map((t) => t.id === id ? { ...t, done: !t.done } : t) } }));
  const removeTask = (id) => setData((d) => ({ ...d, tasks: { ...d.tasks, [activeDate]: (d.tasks[activeDate] || []).filter((t) => t.id !== id) } }));
  const saveTemplate = (event) => {
    event.preventDefault();
    const clean = templateLines
      .map((task) => ({ ...task, text: task.text.trim() }))
      .filter((task) => task.text);
    if (!templateName.trim() || !clean.length) return;
    setData((d) => ({ ...d, templates: [...d.templates, { id: uid(), name: templateName.trim(), tasks: clean }] }));
    setTemplateName(''); setTemplateLines([emptyTemplateTask()]); setNotice('Szablon został zapisany');
  };
  const applyTemplate = (template) => {
    setData((d) => ({ ...d, tasks: { ...d.tasks, [activeDate]: [...(d.tasks[activeDate] || []), ...template.tasks.map((task) => ({ id: uid(), ...normalizeTemplateTask(task), done: false }))] } }));
    setApplyOpen(false); setNotice(`Dodano szablon „${template.name}”`);
  };

  const days = useMemo(() => {
    const year = month.getFullYear(), mon = month.getMonth();
    const offset = (new Date(year, mon, 1).getDay() + 6) % 7;
    const count = new Date(year, mon + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => toKey(new Date(year, mon, i + 1)))];
  }, [month]);

  const navigate = (next) => { setView(next); if (next === 'today') setSelectedDate(todayKey); };
  const selectDay = (key) => { if (!key) return; setSelectedDate(key); setView('day'); };
  const handleAuth = async (email, password) => {
    setAuthError('');
    try {
      if (authMode === 'register') await createAccount(email, password);
      else await signIn(email, password);
    } catch (error) {
      const messages = {
        'auth/invalid-credential': 'Nieprawidłowy e-mail lub hasło.',
        'auth/email-already-in-use': 'To konto już istnieje. Zaloguj się.',
        'auth/weak-password': 'Hasło powinno mieć co najmniej 6 znaków.',
        'auth/invalid-email': 'Podaj poprawny adres e-mail.',
      };
      setAuthError(messages[error.code] || 'Nie udało się zalogować. Spróbuj ponownie.');
    }
  };
  const handleGoogleAuth = async () => {
    setAuthError('');
    try { await signInWithGoogle(); }
    catch (error) { setAuthError(error.code === 'auth/popup-closed-by-user' ? 'Okno logowania zostało zamknięte.' : 'Nie udało się zalogować przez Google.'); }
  };

  if (isFirebaseConfigured && !user) return <AuthScreen mode={authMode} setMode={setAuthMode} submit={handleAuth} submitGoogle={handleGoogleAuth} error={authError} />;
  if (isFirebaseConfigured && !remoteLoaded) return <div className="loading-screen"><div><span className="brand-mark"><Check size={20}/></span><p>Wczytywanie Twojego planera…</p></div></div>;

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => navigate('today')} aria-label="Przejdź do dzisiaj"><span className="brand-mark"><Check size={18}/></span><span>dayflow</span></button>
      <nav aria-label="Główne menu">
        <button className={view === 'today' ? 'active' : ''} onClick={() => navigate('today')}><LayoutList size={18}/><span>Dzisiaj</span></button>
        <button className={['calendar','day'].includes(view) ? 'active' : ''} onClick={() => navigate('calendar')}><CalendarDays size={18}/><span>Kalendarz</span></button>
        <button className={view === 'templates' ? 'active' : ''} onClick={() => navigate('templates')}><CopyPlus size={18}/><span>Szablony</span></button>
      </nav>
      {user && <button className="account-button" onClick={() => signOutUser()} title="Wyloguj się"><span>{user.email}</span><LogOut size={17}/></button>}
    </header>

    <main>
      {(view === 'today' || view === 'day') && <TaskView date={activeDate} tasks={tasks} completed={completed} newTask={newTask} setNewTask={setNewTask} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} addTask={addTask} toggleTask={toggleTask} removeTask={removeTask} isToday={activeDate === todayKey} onBack={view === 'day' ? () => setView('calendar') : null} onApply={() => setApplyOpen(true)} />}
      {view === 'calendar' && <CalendarView month={month} setMonth={setMonth} days={days} selectedDate={selectedDate} selectDay={selectDay} tasksByDate={data.tasks} />}
      {view === 'templates' && <TemplatesView templates={data.templates} templateName={templateName} setTemplateName={setTemplateName} lines={templateLines} setLines={setTemplateLines} saveTemplate={saveTemplate} remove={(id) => setData((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id) }))} />}
    </main>

    {applyOpen && <TemplateDialog templates={data.templates} date={activeDate} close={() => setApplyOpen(false)} apply={applyTemplate} />}
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>;
}

function AuthScreen({ mode, setMode, submit, submitGoogle, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const handleSubmit = async (event) => { event.preventDefault(); setBusy(true); await submit(email, password); setBusy(false); };
  const isRegister = mode === 'register';
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><Check size={21}/></span><span>dayflow</span></div><p className="eyebrow">Twój planer, wszędzie</p><h1>{isRegister ? 'Utwórz konto' : 'Zaloguj się'}</h1><p className="date-copy">Dzięki kontu zadania będą takie same na telefonie i komputerze.</p><button className="google-button" type="button" onClick={submitGoogle}><span>G</span> Kontynuuj przez Google</button><div className="auth-divider"><span>lub e-mail</span></div><form onSubmit={handleSubmit}><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required/></label><label>Hasło<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} minLength="6" required/></label>{error && <p className="auth-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Chwileczkę…' : isRegister ? 'Utwórz konto' : 'Zaloguj się'}</button></form><button className="auth-switch" onClick={() => setMode(isRegister ? 'login' : 'register')}>{isRegister ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Utwórz je'}</button></section></main>;
}

function TaskView({ date, tasks, completed, newTask, setNewTask, startTime, setStartTime, endTime, setEndTime, addTask, toggleTask, removeTask, isToday, onBack, onApply }) {
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  return <section className="page task-page">
    <div className="page-heading">
      <div>{onBack && <button className="back" onClick={onBack}><ChevronLeft size={18}/> Kalendarz</button>}<p className="eyebrow">{isToday ? 'Twój plan' : 'Zaplanowany dzień'}</p><h1>{isToday ? 'Dzisiaj' : dateLabel(date)}</h1><p className="date-copy">{dateLabel(date, true)}</p></div>
      <button className="secondary" onClick={onApply}><CopyPlus size={17}/> Zastosuj szablon</button>
    </div>
    <div className="progress-card"><div><strong>{completed} z {tasks.length}</strong><span>zadań ukończonych</span></div><div className="progress-track"><i style={{ width: `${percent}%` }}/></div><b>{percent}%</b></div>
    <form className="add-task" onSubmit={addTask}>
      <div className="task-name-field"><Plus size={21}/><input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Dodaj zadanie…" aria-label="Nowe zadanie"/></div>
      <div className="time-fields" aria-label="Ramy czasowe zadania"><Clock3 size={17}/><label><span>Od</span><input name="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Godzina rozpoczęcia"/></label><i>–</i><label><span>Do</span><input name="endTime" type="time" value={endTime} min={startTime || undefined} onChange={(e) => setEndTime(e.target.value)} aria-label="Godzina zakończenia"/></label></div>
      <button>Dodaj</button>
    </form>
    <div className="task-list">
      {tasks.length ? tasks.map((task) => <article className={`task ${task.done ? 'done' : ''}`} key={task.id}>
        <button className="check" onClick={() => toggleTask(task.id)} aria-label={task.done ? 'Oznacz jako niewykonane' : 'Oznacz jako wykonane'}>{task.done ? <Check size={17}/> : <Circle size={19}/>}</button>
        <div className="task-copy"><span>{task.text}</span>{(task.startTime || task.endTime) && <small><Clock3 size={14}/>{task.startTime || '—'} – {task.endTime || '—'}</small>}</div><button className="icon-button remove" onClick={() => removeTask(task.id)} aria-label="Usuń zadanie"><Trash2 size={17}/></button>
      </article>) : <div className="empty"><span>✦</span><h2>Spokojny dzień</h2><p>Nie ma tu jeszcze zadań. Dodaj pierwsze powyżej.</p></div>}
    </div>
  </section>;
}

function CalendarView({ month, setMonth, days, selectedDate, selectDay, tasksByDate }) {
  const title = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(month);
  const move = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  return <section className="page calendar-page"><div className="page-heading"><div><p className="eyebrow">Zaplanuj z wyprzedzeniem</p><h1>Kalendarz</h1><p className="date-copy">Wybierz dzień, by zobaczyć lub ułożyć jego plan.</p></div></div>
    <div className="calendar-card"><div className="calendar-head"><h2>{title}</h2><div><button onClick={() => move(-1)} aria-label="Poprzedni miesiąc"><ChevronLeft/></button><button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Dziś</button><button onClick={() => move(1)} aria-label="Następny miesiąc"><ChevronRight/></button></div></div>
      <div className="weekdays">{['Pon','Wt','Śr','Czw','Pt','Sob','Nie'].map((x) => <span key={x}>{x}</span>)}</div>
      <div className="calendar-grid">{days.map((key, i) => key ? <button key={key} className={`${key === todayKey ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`} onClick={() => selectDay(key)}><span>{fromKey(key).getDate()}</span>{(tasksByDate[key] || []).length > 0 && <i>{(tasksByDate[key] || []).filter(t => !t.done).length || <Check size={11}/>}</i>}</button> : <span key={`empty-${i}`}/>)}</div>
    </div>
  </section>;
}

function TemplatesView({ templates, templateName, setTemplateName, lines, setLines, saveTemplate, remove }) {
  const updateLine = (i, field, value) => setLines(lines.map((task, n) => n === i ? { ...task, [field]: value } : task));
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">Powtarzalne plany</p><h1>Szablony</h1><p className="date-copy">Zapisz zestaw zadań i dodawaj go do dowolnego dnia.</p></div></div>
    <div className="templates-layout"><form className="template-form panel" onSubmit={saveTemplate}><h2>Nowy szablon</h2><label>Nazwa<input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="np. Poranna rutyna" required/></label><div className="line-label"><span>Zadania i godziny</span></div>{lines.map((task, i) => <div className="template-task-input" key={i}><div className="line-input"><input value={task.text} onChange={(e) => updateLine(i, 'text', e.target.value)} placeholder={`Zadanie ${i + 1}`} aria-label={`Treść zadania ${i + 1}`} required={i === 0}/>{lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, n) => n !== i))} aria-label={`Usuń zadanie ${i + 1}`}><X size={17}/></button>}</div><div className="template-time-fields"><Clock3 size={15}/><label>Od<input type="time" value={task.startTime} onChange={(e) => updateLine(i, 'startTime', e.target.value)} aria-label={`Godzina rozpoczęcia zadania ${i + 1}`}/></label><span>–</span><label>Do<input type="time" value={task.endTime} min={task.startTime || undefined} onChange={(e) => updateLine(i, 'endTime', e.target.value)} aria-label={`Godzina zakończenia zadania ${i + 1}`}/></label></div></div>)}<button type="button" className="text-button" onClick={() => setLines([...lines, emptyTemplateTask()])}><Plus size={16}/> Dodaj kolejne zadanie</button><button className="primary">Zapisz szablon</button></form>
      <div className="template-list"><h2>Twoje szablony <span>{templates.length}</span></h2>{templates.length ? templates.map((t) => <article className="template-card" key={t.id}><div className="template-title"><span><CopyPlus size={19}/></span><div><h3>{t.name}</h3><p>{t.tasks.length} {t.tasks.length === 1 ? 'zadanie' : 'zadania'}</p></div><button className="icon-button" onClick={() => remove(t.id)} aria-label="Usuń szablon"><Trash2 size={17}/></button></div><ul>{t.tasks.map((rawTask, i) => { const task = normalizeTemplateTask(rawTask); return <li key={i}><span>{task.text}</span>{(task.startTime || task.endTime) && <small><Clock3 size={13}/>{task.startTime || '—'} – {task.endTime || '—'}</small>}</li>; })}</ul></article>) : <div className="empty small"><h3>Brak szablonów</h3><p>Utwórz pierwszy zestaw po lewej.</p></div>}</div>
    </div>
  </section>;
}

function TemplateDialog({ templates, date, close, apply }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><p className="eyebrow">{dateLabel(date)}</p><h2 id="modal-title">Wybierz szablon</h2></div><button className="icon-button" onClick={close}><X/></button></div>{templates.length ? <div className="modal-list">{templates.map((t) => <button key={t.id} onClick={() => apply(t)}><span><strong>{t.name}</strong><small>{t.tasks.length} zadań</small></span><Plus size={20}/></button>)}</div> : <div className="empty small"><p>Najpierw utwórz szablon w zakładce Szablony.</p></div>}</div></div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
