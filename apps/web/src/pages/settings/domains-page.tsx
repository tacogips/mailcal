import { createSignal, For, type JSX, onMount, Show } from "solid-js";
import {
  CREATE_DOMAIN_MUTATION,
  SET_DOMAIN_STATUS_MUTATION,
  VERIFY_DOMAIN_MUTATION,
} from "../../api/documents";
import { graphqlRequest } from "../../api/graphql-client";
import type { DomainStatus, MailDomainView } from "../../api/schema-types";
import { describeErrors } from "../../lib/mutation-error";
import { pushToast } from "../../lib/toast";
import { useStore } from "../../store/store-context";
import "./settings.css";

export default function DomainsPage(): JSX.Element {
  const store = useStore();
  const [name, setName] = createSignal("");
  const [catchAll, setCatchAll] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [expanded, setExpanded] = createSignal<string | null>(null);

  onMount(() => {
    void store.loadReferenceData();
  });

  async function addDomain(event: Event): Promise<void> {
    event.preventDefault();
    setBusy(true);
    const result = await graphqlRequest<
      { readonly createDomain: MailDomainView },
      Record<string, unknown>
    >(CREATE_DOMAIN_MUTATION, { name: name(), catchAll: catchAll() });
    setBusy(false);
    if (!result.ok) {
      pushToast("error", describeErrors(result.errors));
      return;
    }
    setName("");
    setExpanded(result.data.createDomain.id);
    pushToast(
      "info",
      "Domain added. Publish the DNS records below, then verify it.",
    );
    await store.loadReferenceData();
  }

  async function verify(id: string): Promise<void> {
    const result = await graphqlRequest<
      { readonly verifyDomain: { readonly id: string } },
      Record<string, unknown>
    >(VERIFY_DOMAIN_MUTATION, { id });
    if (!result.ok) {
      pushToast("error", describeErrors(result.errors));
      return;
    }
    pushToast("success", "Domain verified and active");
    await store.loadReferenceData();
  }

  async function setStatus(id: string, status: DomainStatus): Promise<void> {
    const result = await graphqlRequest<
      { readonly setDomainStatus: { readonly id: string } },
      Record<string, unknown>
    >(SET_DOMAIN_STATUS_MUTATION, { id, status });
    if (!result.ok) {
      pushToast("error", describeErrors(result.errors));
      return;
    }
    await store.loadReferenceData();
  }

  return (
    <div class="settings-page">
      <h1>Domains</h1>

      <form class="panel" onSubmit={(event) => void addDomain(event)}>
        <h2>Add a domain</h2>
        <div class="field">
          <label for="domain-name">Domain name</label>
          <input
            id="domain-name"
            type="text"
            required
            placeholder="example.com"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </div>
        <div class="field row">
          <input
            id="domain-catchall"
            type="checkbox"
            style={{ width: "auto" }}
            checked={catchAll()}
            onChange={(event) => setCatchAll(event.currentTarget.checked)}
          />
          <label for="domain-catchall" style={{ margin: 0 }}>
            Accept mail for every address on this domain (catch-all)
          </label>
        </div>
        <button type="submit" class="primary" disabled={busy()}>
          Add domain
        </button>
      </form>

      <For each={store.domains()}>
        {(domain) => (
          <div class="panel">
            <h2>
              {domain.name} <span class="muted">({domain.status})</span>
            </h2>
            <p class="muted">
              {domain.messageCount} message(s)
              {domain.catchAll ? ", catch-all" : ", known addresses only"}
            </p>

            <div class="row">
              <Show when={domain.verifiedAt === null}>
                <button type="button" onClick={() => void verify(domain.id)}>
                  I have published the records - verify
                </button>
              </Show>
              <Show when={domain.status === "ACTIVE"}>
                <button
                  type="button"
                  onClick={() => void setStatus(domain.id, "DISABLED")}
                >
                  Disable
                </button>
              </Show>
              <Show when={domain.status === "DISABLED"}>
                <button
                  type="button"
                  onClick={() => void setStatus(domain.id, "ACTIVE")}
                >
                  Enable
                </button>
              </Show>
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) =>
                    current === domain.id ? null : domain.id,
                  )
                }
              >
                {expanded() === domain.id ? "Hide" : "Show"} DNS records
              </button>
            </div>

            <Show when={expanded() === domain.id}>
              <table class="dns-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Value</th>
                    <th>Priority</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={domain.dnsRecords}>
                    {(record) => (
                      <tr>
                        <td>{record.type}</td>
                        <td>
                          <code>{record.name}</code>
                        </td>
                        <td>
                          <code>{record.value}</code>
                        </td>
                        <td>{record.priority ?? ""}</td>
                        <td class="muted">{record.purpose}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </div>
        )}
      </For>

      <a href="/">Back to mail</a>
    </div>
  );
}
