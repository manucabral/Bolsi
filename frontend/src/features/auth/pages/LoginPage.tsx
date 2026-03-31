import { useState } from "preact/hooks";
import { Link, useNavigate } from "react-router-dom";
import { Panel } from "../../../shared/ui/Panel";
import { loginUser } from "../../../platform/pywebview/user.api";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { useOkNoticeToast } from "../../../shared/ui/useToastNotice";

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  useOkNoticeToast(notice, setNotice);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setNotice(null);

    if (!username || !password) return;

    try {
      setSubmitting(true);
      const response = await loginUser(username, password);
      setNotice({ ok: response.ok, message: response.message });

      if (!response.ok) {
        return;
      }

      await refreshSession();
      navigate("/dashboard", { replace: true });
    } catch {
      setNotice({ ok: false, message: "Ocurrio un error al iniciar sesion." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="mx-auto flex min-h-screen w-full max-w-[1060px] items-center justify-center px-4 py-6">
      <Panel
        title="Ingresar"
        subtitle="Tus datos se guardan solo en tu PC."
        showVersionInHeader={false}
      >
        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-violet-300/90">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              placeholder="usuario"
              required
              class="w-full rounded-[0.85rem] border border-violet-300/35 bg-violet-950/65 px-3.5 py-2.5 text-violet-100 outline-none transition placeholder:text-violet-300/45 focus:border-fuchsia-300/90 focus:bg-violet-950/85 focus:shadow-[0_0_0_3px_rgba(141,109,255,0.3)]"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-violet-300/90">
              Contrasena
            </label>
            <div class="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                placeholder="********"
                required
                class="w-full rounded-[0.85rem] border border-violet-300/35 bg-violet-950/65 px-3.5 py-2.5 pr-11 text-violet-100 outline-none transition placeholder:text-violet-300/45 focus:border-fuchsia-300/90 focus:bg-violet-950/85 focus:shadow-[0_0_0_3px_rgba(141,109,255,0.3)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                class="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md border border-violet-300/25 bg-black/25 p-1.5 text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100"
                title={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="h-4 w-4"
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9-4-10-8a11.77 11.77 0 0 1 5.09-6.09" />
                    <path d="M1 1l22 22" />
                    <path d="M9.9 4.24A10.93 10.93 0 0 1 12 4c5 0 9 4 10 8a11.8 11.8 0 0 1-1.67 3.25" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="h-4 w-4"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            class="w-full rounded-[0.88rem] border border-fuchsia-300/35 bg-[linear-gradient(120deg,#5f4dff_0%,#cc4cff_100%)] px-4 py-2.5 font-extrabold text-white transition hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_16px_30px_rgba(123,82,255,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        <p class="text-center text-sm text-violet-300/95">
          No tenes cuenta?{" "}
          <Link
            to="/register"
            class="font-semibold text-violet-100 underline decoration-violet-300/80 underline-offset-4"
          >
            Crear cuenta
          </Link>
        </p>
      </Panel>
    </main>
  );
}
