import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ICON_PATHS, Icon, type IconName } from "../icons/Icon";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ErrorPanel } from "./ErrorPanel";
import { Figure } from "./Figure";
import { Notice } from "./Notice";
import { RuleOfTwoLetters } from "./RuleOfTwoLetters";
import { SegmentedControl } from "./SegmentedControl";
import { StatusPill } from "./StatusPill";

const html = (node: React.ReactElement): string => renderToStaticMarkup(node);

describe("Icon", () => {
  it("is decorative (aria-hidden) unless it has a label", () => {
    expect(html(<Icon name="gate" />)).toContain('aria-hidden="true"');
    const labelled = html(<Icon name="gate" label="Held" />);
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Held"');
    expect(labelled).not.toContain("aria-hidden");
  });

  it("draws a path for every name", () => {
    for (const name of Object.keys(ICON_PATHS) as IconName[]) expect(html(<Icon name={name} />), name).toMatch(/<path d="[^"]+"/);
  });
});

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    expect(html(<Button>Run</Button>)).toContain('type="button"');
  });

  it("is disabled and marked busy while pending", () => {
    const out = html(<Button pending>Running…</Button>);
    expect(out).toContain("disabled");
    expect(out).toContain('aria-busy="true"');
  });

  it("carries the variant class", () => {
    expect(html(<Button variant="danger">Revoke 4 flows</Button>)).toContain("pw-btn--danger");
  });
});

describe("StatusPill", () => {
  it("shows the status word together with an icon, never colour alone", () => {
    const out = html(<StatusPill status="held" />);
    expect(out).toContain("pw-status--hold");
    expect(out).toContain("held");
    expect(out).toContain("<svg");
  });

  it("renders an unknown status neutral with its raw text", () => {
    const out = html(<StatusPill status="weird" />);
    expect(out).toContain("pw-status--neutral");
    expect(out).toContain("weird");
  });

  it("lets the caller override the family (time-travel markers)", () => {
    expect(html(<StatusPill status="marker" family="marked" />)).toContain("pw-status--marked");
  });
});

describe("Notice and ErrorPanel", () => {
  it("names the kind of notice in text", () => {
    expect(html(<Notice variant="consequence">It quarantines the source.</Notice>)).toContain("What this does.");
    expect(html(<Notice variant="caveat">Flags are current values.</Notice>)).toContain("Caveat.");
  });

  it("announces errors and always shows the raw code", () => {
    const out = html(<ErrorPanel title="Can't reach the Pathwarden API" code="falkordb_unavailable" />);
    expect(out).toContain('role="alert"');
    expect(out).toContain("falkordb_unavailable");
  });
});

describe("SegmentedControl", () => {
  it("is a radio group with the selected option checked and a visible hint", () => {
    const out = html(
      <SegmentedControl
        legend="Guard"
        value="on"
        onChange={() => undefined}
        options={[
          { value: "on", label: "On", hint: "Starts from a clean workspace." },
          { value: "off", label: "Off" },
        ]}
      />,
    );
    expect(out).toContain("<fieldset");
    expect(out).toContain("<legend");
    expect(out.match(/type="radio"/g)).toHaveLength(2);
    expect(out).toContain("checked");
    expect(out).toContain("Starts from a clean workspace.");
  });

  it("explains a disabled option in visible text", () => {
    const out = html(
      <SegmentedControl
        legend="Agents"
        value="scripted"
        onChange={() => undefined}
        options={[
          { value: "scripted", label: "Scripted" },
          { value: "live", label: "Live", disabled: true, hint: "Needs PW_LLM_API_KEY." },
        ]}
      />,
    );
    expect(out).toContain("Needs PW_LLM_API_KEY.");
  });
});

describe("RuleOfTwoLetters", () => {
  it("states the meaning of every letter in text a screen reader can read", () => {
    const out = html(<RuleOfTwoLetters data={{ A: true, B: false, C: true, green: true }} />);
    expect(out).toContain("processes untrusted input: yes");
    expect(out).toContain("has access to secrets: no");
    expect(out).toContain("Rule of Two OK");
  });

  it("says when the rule is violated", () => {
    expect(html(<RuleOfTwoLetters data={{ A: true, B: true, C: true, green: false }} legend />)).toContain("Rule of Two violated");
  });
});

describe("Dialog and Figure", () => {
  it("renders no content while closed (nothing fetches or announces behind it)", () => {
    const out = html(
      <Dialog open={false} onClose={() => undefined} title="Release the healed version?">
        <p>secret body</p>
      </Dialog>,
    );
    expect(out).toContain("<dialog");
    expect(out).not.toContain("secret body");
  });

  it("gives a figure a number, a caption and a source", () => {
    const out = html(
      <Figure n={1} caption="Lineage of act-0001." source="q2a_untrusted_witness">
        <span />
      </Figure>,
    );
    expect(out).toContain("FIG. 1");
    expect(out).toContain("Source: q2a_untrusted_witness");
  });
});
