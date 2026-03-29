import { useState } from "preact/hooks";
import { Link } from "react-router-dom";
import { Panel } from "../../../shared/ui/Panel";
import { registerUser } from "../../../platform/pywebview/user.api";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { useOkNoticeToast } from "../../../shared/ui/useToastNotice";

export function RegisterPage() {
  const { refreshSession } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  useOkNoticeToast(notice, setNotice);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setNotice(null);

    if (password !== confirmPassword) {
      setNotice({ ok: false, message: "Las contraseñas no coinciden" });
      return;
    }

    if (!username || !email || !password) return;

    try {
      setSubmitting(true);
      const response = await registerUser(username, email, password);

      if (response.ok && response.data?.user?.username) {
        setNotice({
          ok: true,
          message: `${response.message} (${response.data.user.username})`,
        });
        await refreshSession();
      } else {
        setNotice({ ok: response.ok, message: response.message });
      }
    } catch {
      setNotice({
        ok: false,
        message: "Ocurrio un error al registrar el usuario.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="mx-auto flex min-h-screen w-full max-w-[1060px] items-center justify-center px-4 py-6">
      <Panel
        title="Crear cuenta"
        subtitle="Completa tus datos para empezar — totalmente open-source y seguro"
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
              Email
            </label>
            <input
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="tu@email.com"
              required
              class="w-full rounded-[0.85rem] border border-violet-300/35 bg-violet-950/65 px-3.5 py-2.5 text-violet-100 outline-none transition placeholder:text-violet-300/45 focus:border-fuchsia-300/90 focus:bg-violet-950/85 focus:shadow-[0_0_0_3px_rgba(141,109,255,0.3)]"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-violet-300/90">
              Contrasena
            </label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="minimo 6 caracteres"
              required
              minLength={6}
              class="w-full rounded-[0.85rem] border border-violet-300/35 bg-violet-950/65 px-3.5 py-2.5 text-violet-100 outline-none transition placeholder:text-violet-300/45 focus:border-fuchsia-300/90 focus:bg-violet-950/85 focus:shadow-[0_0_0_3px_rgba(141,109,255,0.3)]"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-violet-300/90">
              Confirmar contrasena
            </label>
            <input
              type="password"
              value={confirmPassword}
              onInput={(e) =>
                setConfirmPassword((e.target as HTMLInputElement).value)
              }
              required
              minLength={6}
              class="w-full rounded-[0.85rem] border border-violet-300/35 bg-violet-950/65 px-3.5 py-2.5 text-violet-100 outline-none transition placeholder:text-violet-300/45 focus:border-fuchsia-300/90 focus:bg-violet-950/85 focus:shadow-[0_0_0_3px_rgba(141,109,255,0.3)]"
            />
          </div>

          <button
            type="submit"
            class="w-full rounded-[0.88rem] border border-fuchsia-300/35 bg-[linear-gradient(120deg,#5f4dff_0%,#cc4cff_100%)] px-4 py-2.5 font-extrabold text-white transition hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_16px_30px_rgba(123,82,255,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Registrando..." : "Registrarme"}
          </button>
        </form>

        <p class="text-center text-sm text-violet-300/95">
          Ya tienes cuenta?{" "}
          <Link
            to="/login"
            class="font-semibold text-violet-100 underline decoration-violet-300/80 underline-offset-4"
          >
            Ingresar
          </Link>
        </p>
      </Panel>
    </main>
  );
}
