import { useState, useRef, useEffect } from "react";
import { PRESETS, APPETITE, DEFAULTS, runBottomUp } from "./data.js";

const money = (x) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);

// A GUIDED assistant: it asks questions one at a time and estimates from our
// sourced model. It never invents numbers — every default comes from the same
// researched benchmarks as the calculator.
export default function ChatAssistant({ onApply }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("size");
  const [log, setLog] = useState([
    { from: "bot", text: "Hi 👋 I'm your Payfinia savings assistant. I'll ask a few quick questions and estimate what your bank could save by moving to instant payments. Ready?" },
    { from: "bot", text: "First — how big is your bank?" },
  ]);
  const [base, setBase] = useState(PRESETS["Mid CFI (~$1B)"]);
  const [ans, setAns] = useState({});
  const [numVal, setNumVal] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log, open]);

  const push = (msgs) => setLog((l) => [...l, ...msgs]);

  function chooseSize(key) {
    const p = key === "custom" ? PRESETS["Mid CFI (~$1B)"] : PRESETS[key];
    setBase(p);
    const label = key === "custom" ? "I'll enter my own numbers" : p.label;
    push([
      { from: "user", text: label },
      { from: "bot", text: `Got it. Roughly how many checks does your bank process per year? For a bank your size I estimate about ${p.Check.toLocaleString()}.` },
      { from: "note", text: "Estimates are based on our research for banks of this size — see the Rail Data tab for sources." },
    ]);
    setNumVal(String(p.Check));
    setStep("checks");
  }

  function submitNum(nextKey, nextQuestion, estimate) {
    const v = Math.max(0, Math.round(+numVal || 0));
    const key = step;
    setAns((a) => ({ ...a, [key]: v }));
    push([{ from: "user", text: v.toLocaleString() }, { from: "bot", text: nextQuestion }]);
    setNumVal(estimate != null ? String(estimate) : "");
    setStep(nextKey);
  }

  function chooseAppetite(level) {
    const subst = APPETITE[level];
    const vol = {
      Check: ans.checks ?? base.Check,
      Wire: ans.wires ?? base.Wire,
      "Same-Day ACH": base["Same-Day ACH"],
      ACH: ans.ach ?? base.ACH,
    };
    const res = runBottomUp(vol, DEFAULTS, subst, base.oneTime, base.annual, 10, 5);
    const payload = { vol, oneTime: base.oneTime, annual: base.annual, subst };
    setAns((a) => ({ ...a, appetite: level, payload }));

    const lines = [{ from: "user", text: level }];
    if (res.net > 0) {
      lines.push({ from: "bot", text: `Here's the estimate 🎉` });
      lines.push({ from: "result", res });
      lines.push({ from: "bot", text: "Most of that comes from replacing high-cost checks and wires — instant payments cost about $0.77 each all-in. Want to see the full breakdown and adjust the numbers yourself?" });
    } else {
      lines.push({ from: "bot", text: "At these numbers the migration doesn't pay back yet — usually that means low check/wire volume. Try a higher migration share, or open the full calculator to explore." });
    }
    push(lines);
    setStep("done");
  }

  function showResults() {
    if (ans.payload) onApply(ans.payload);
    setOpen(false);
  }

  return (
    <>
      <button className="chatfab" onClick={() => setOpen((o) => !o)} aria-label="Open savings assistant">
        {open ? "×" : "💬"}
      </button>

      {open && (
        <div className="chatpanel">
          <div className="chathead">
            <div><b>Savings Assistant</b><span>Guided · uses our sourced model</span></div>
            <button onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>

          <div className="chatbody">
            {log.map((m, i) => {
              if (m.from === "note") return <div key={i} className="msg note">{m.text}</div>;
              if (m.from === "result") {
                const r = m.res;
                return (
                  <div key={i} className="msg bot resultcard">
                    <div className="big">{money(r.net)}<span>/year</span></div>
                    <div className="sub">≈ {money(r.net / 12)}/month · payback ~{r.payback.toFixed(1)} mo · 5-yr value {money(r.npv)}</div>
                  </div>
                );
              }
              return <div key={i} className={`msg ${m.from}`}>{m.text}</div>;
            })}
            <div ref={endRef} />
          </div>

          <div className="chatinput">
            {step === "size" && (
              <div className="choices">
                <button onClick={() => chooseSize("Small CFI (~$200M)")}>Small (~$200M)</button>
                <button onClick={() => chooseSize("Mid CFI (~$1B)")}>Mid (~$1B)</button>
                <button onClick={() => chooseSize("Large CFI (~$5B)")}>Large (~$5B)</button>
                <button onClick={() => chooseSize("custom")}>Enter my own</button>
              </div>
            )}
            {step === "checks" && (
              <NumberRow val={numVal} setVal={setNumVal} unit="checks / yr"
                onSubmit={() => submitNum("wires", `And roughly how many wires per year? (~${base.Wire.toLocaleString()} for a bank your size.)`, base.Wire)} />
            )}
            {step === "wires" && (
              <NumberRow val={numVal} setVal={setNumVal} unit="wires / yr"
                onSubmit={() => submitNum("ach", `Last one — standard ACH payments per year? (~${base.ACH.toLocaleString()}.)`, base.ACH)} />
            )}
            {step === "ach" && (
              <NumberRow val={numVal} setVal={setNumVal} unit="ACH / yr"
                onSubmit={() => submitNum("appetite", "How aggressively do you expect to shift checks & wires to instant? Most banks start moderate.", null)} />
            )}
            {step === "appetite" && (
              <div className="choices">
                <button onClick={() => chooseAppetite("Conservative")}>Conservative</button>
                <button onClick={() => chooseAppetite("Moderate")}>Moderate</button>
                <button onClick={() => chooseAppetite("Aggressive")}>Aggressive</button>
              </div>
            )}
            {step === "done" && (
              <div className="choices">
                {ans.payload && <button className="primary" onClick={showResults}>Show me the full breakdown →</button>}
                <button onClick={() => { setStep("size"); setAns({}); setLog(log.slice(0, 2)); }}>Start over</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NumberRow({ val, setVal, unit, onSubmit }) {
  return (
    <div className="numrow">
      <input type="number" min="0" value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }} />
      <span className="unit">{unit}</span>
      <button className="primary" onClick={onSubmit}>Next →</button>
    </div>
  );
}
