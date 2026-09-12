import { Radio } from "lucide-react";

export default function HeaderLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
        <Radio className="w-6 h-6 font-bold" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-slate-100 tracking-tight">
            Open Ried Sens
          </span>
          <span className="hidden sm:block text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Bürstadt & Lampertheim
          </span>
        </div>
        <p className="text-sm text-slate-400 hidden sm:block">
          Initiative von{" "}
          <a
            href="https://kamue.me"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 font-medium hover:underline"
          >
            KAMÜ Kulturzentrum
          </a>{" "}
          & Bürgerinnen/Bürgern
        </p>
      </div>
    </div>
  );
}
