import { useState } from "react";
import { ApiError, api } from "../lib/api";
import { Brand } from "../components/common";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "sign-up";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (signup) await api.signUp(name.trim(), email.trim(), password);
      else await api.signIn(email.trim(), password);
      await onAuthenticated();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-panel" aria-labelledby="auth-title">
      <Brand />
      <div className="auth-copy">
        <span className="eyebrow">ACESSO LOCAL PROTEGIDO</span>
        <h1 id="auth-title">{signup ? "Crie seu acesso" : "Acesse seus exames"}</h1>
        <p>{signup ? "Crie uma conta para manter seus dados clínicos separados e protegidos." : "Consulte análises, biomarcadores e planos em uma única linha de cuidado."}</p>
      </div>
      <form onSubmit={submit} className="auth-form">
        {signup ? <label>Nome<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required /></label> : null}
        <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={8} required /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button primary" disabled={busy}>{busy ? "Aguarde..." : signup ? "Criar conta" : "Entrar"}</button>
      </form>
      <button type="button" className="text-button" onClick={() => { setMode(signup ? "sign-in" : "sign-up"); setError(""); }}>
        {signup ? "Já tenho uma conta" : "Criar uma conta"}
      </button>
    </section>
  </main>;
}
