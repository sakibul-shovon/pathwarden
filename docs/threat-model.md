# Threat model

What Pathwarden is designed to stop, the assumptions it relies on, and what it explicitly does not claim. The enforcement details of the API (keys, human-only endpoints) are in [`SECURITY.md`](SECURITY.md).

## What is protected

The **confidentiality of secrets against prompt injection through shared state**: an attacker who controls only untrusted input (a public issue, a web page, an email) must not be able to make a multi-agent system send secret values to an external sink, even when
- every agent individually satisfies the Rule of Two,
- the attack is split across agents (Triage, Fixer, Release), and
- the instruction is stored in shared memory and acted on days later (a sleeper).

## Mechanism and assumptions

The gate is deterministic. Before an external action it asks the lineage graph two path questions about the payload (untrusted witness, secret witness) and one about quarantine. It never reads content and calls no model. It therefore relies on:

1. **Correct registry labels.** Which sources are untrusted or secret, which tools read, write, load or are external, which sinks are external: all come from `fixtures/registry.yaml`, never from a model. A source labelled `internal` that is really attacker-controlled is trusted.
2. **Complete mediation.** Every read, write, load and action goes through the runtime (or the MCP gateway). Anything that bypasses both is invisible.
3. **Conservative context.** A write derives from everything the session read or loaded, because the system cannot see which part of the context the model used. This can over-taint; it cannot under-taint.
4. **Sanitizers clear untrusted labels only.** A schema sanitizer (a fixed, validated output such as `{issue_id, component, severity, kind}`) cuts untrusted paths; secret paths are cut only by a human approval, because an integer or an enum can still encode a secret.

## Non-goals (stated, not hidden)

| Not covered | Why |
|---|---|
| Side channels outside the runtime and the gateway (an agent with its own network tool) | the gate only sees what is recorded |
| Wrong registry labels | the labels are the trust root |
| The LLM's internal state | invisible to the gateway; hence the conservative context |
| Secret egress with no untrusted influence | a warning at most, not a hold: the attack model is injection |
| Real attackers against the demo data | the scripted agents *simulate* a compromised agent; the live-agent study (P8, not implemented) is where real models would be tested |
| Cryptographic integrity of memory, user accounts, OAuth, rate limiting, CORS, TLS | out of scope for this project |
| Authentication of the MCP tool server and gateway | local stdio processes that use their user's database credentials |

## Responses that need a human

Risk-reducing actions may be automatic (quarantine, sandbox replay). Risk-increasing actions need a human: releasing a quarantine, approving a held action or a healed release, applying a permission change. In hosted mode these endpoints need the workspace key as well as the `X-PW-Human: true` header; the header alone is a deliberate-action guard, not authentication.

## Residual risk to state to users

- A perfect result on a synthetic dataset that shares the gate's lineage model demonstrates conformance, not coverage (see the README, section 11).
- The healed release is only as clean as the quarantine: it is replayed in a sandbox and gated again before a human is asked.
