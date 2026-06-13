"use client";
import { Mail, Phone, Users } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { EQUIPE, iniciais, telHref } from "@/lib/equipe";
import { PROJETO } from "@/lib/projeto";

export function Equipe() {
  return (
    <div className="stack">
      <Panel>
        <div className="page-intro">
          <Eyebrow color="#3BE0C9">Quem construiu</Eyebrow>
          <h2>Integrantes do grupo</h2>
          <p>
            Equipe do Projeto Integrador <b>{PROJETO.desafio}</b> — {PROJETO.curso}. Seis pessoas responsáveis
            pela engenharia do pipeline, camada de IA, automação e este painel de produto.
          </p>
          <div className="lead-tags">
            <span className="cyan">{EQUIPE.length} integrantes</span>
            <span>Janela: {PROJETO.janela}</span>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="panel-head"><div><Eyebrow>Contatos</Eyebrow><h3>Membros</h3></div><span className="muted-tag"><Users size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />{EQUIPE.length}</span></div>
        <div className="team-grid">
          {EQUIPE.map((m) => (
            <div key={m.email} className="member">
              <div className="member-av">{iniciais(m.nome)}</div>
              <div className="member-main">
                <span className="member-name">{m.nome}</span>
                <a className="member-mail" href={`mailto:${m.email}`}><Mail size={12} /> {m.email}</a>
                <a className="member-tel" href={telHref(m.telefone)}><Phone size={12} /> {m.telefone}</a>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
