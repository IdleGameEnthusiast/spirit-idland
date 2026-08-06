/* Browser side of the harness: runs the registry and writes the result into the page.
 *
 * The summary line carries `data-status="pass"` or `"fail"` and the counts, so a headless
 * run (`msedge --headless --dump-dom tests.html`) can be read by a script as easily as by
 * a person. */

(function () {
  const harness = window.SpiritTests;
  const out = document.getElementById("results");
  const summary = document.getElementById("summary");

  let passed = 0;
  const failures = [];

  for (const entry of harness.registry) {
    let error = null;
    try {
      entry.fn();
      passed += 1;
    } catch (err) {
      error = err;
      failures.push({ name: entry.name, error: err });
    }

    const row = document.createElement("li");
    row.className = error ? "fail" : "pass";
    row.innerHTML = error
      ? `<span class="mark">FAIL</span><span class="name">${entry.name}</span><span class="why">${error.message}</span>`
      : `<span class="mark">ok</span><span class="name">${entry.name}</span>`;
    out.appendChild(row);
  }

  const total = harness.registry.length;
  summary.setAttribute("data-status", failures.length ? "fail" : "pass");
  summary.setAttribute("data-passed", String(passed));
  summary.setAttribute("data-total", String(total));
  summary.textContent = failures.length
    ? `${passed}/${total} checks passed, ${failures.length} failed.`
    : `${passed}/${total} checks passed.`;

  document.body.classList.toggle("has-failures", failures.length > 0);
})();
