import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorSummary } from "./ErrorSummary";
import { Field } from "./Field";
import { PasswordField } from "./PasswordField";

const html = (node: React.ReactElement): string => renderToStaticMarkup(node);

describe("Field", () => {
  it("ties the label, the hint and the error to the control", () => {
    const out = html(
      <Field id="ws" label="Workspace" hint="Lowercase letters." error="Enter the workspace name.">
        {(a) => <input {...a} />}
      </Field>,
    );
    expect(out).toContain('<label for="ws"');
    expect(out).toContain('id="ws-hint"');
    expect(out).toContain('id="ws-error"');
    expect(out).toContain('aria-describedby="ws-hint ws-error"');
    expect(out).toContain('aria-invalid="true"');
  });

  it("says Error: before the message for screen readers and has no invalid state without an error", () => {
    expect(html(<Field id="a" label="A" error="Bad.">{(x) => <input {...x} />}</Field>)).toContain("Error: </span>Bad.");
    const clean = html(<Field id="a" label="A">{(x) => <input {...x} />}</Field>);
    expect(clean).not.toContain("aria-invalid");
    expect(clean).not.toContain("aria-describedby");
  });
});

describe("PasswordField", () => {
  it("is a password input that the browser must not remember or spell-check, with a show button", () => {
    const out = html(<PasswordField id="k" label="Access key" value="" onChange={() => undefined} />);
    expect(out).toContain('type="password"');
    expect(out).toContain('autoComplete="off"');
    expect(out).toContain('spellcheck="false"');
    expect(out).toContain('aria-pressed="false"');
    expect(out).toContain("Show");
  });
});

describe("ErrorSummary", () => {
  it("renders nothing when there are no errors", () => {
    expect(html(<ErrorSummary errors={[]} focusKey={0} />)).toBe("");
  });

  it("announces the problem and links each error to its field", () => {
    const out = html(
      <ErrorSummary
        focusKey={1}
        errors={[
          { fieldId: "key", message: "This key was not accepted." },
          { message: "The API did not answer. Try again." },
        ]}
      />,
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain("There is a problem");
    expect(out).toContain('href="#key"');
    expect(out).toContain("The API did not answer. Try again.");
    expect(out.match(/<a /g)).toHaveLength(1); // an error without a field has no link
  });
});
