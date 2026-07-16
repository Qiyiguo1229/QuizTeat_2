(() => {
  const state = {
    bank: [],
    meta: null,
    queue: [],
    index: 0,
    correct: 0,
    answered: 0,
    mode: null,
    instant: true,
    selected: new Set(),
    locked: false,
    sessionWrongDetails: [],
  };

  const els = {
    views: {
      home: document.getElementById("view-home"),
      quiz: document.getElementById("view-quiz"),
      result: document.getElementById("view-result"),
    },
    totalCount: document.getElementById("total-count"),
    countTf: document.getElementById("count-tf"),
    countSingle: document.getElementById("count-single"),
    countMulti: document.getElementById("count-multi"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    liveScore: document.getElementById("live-score"),
    qType: document.getElementById("q-type"),
    qDiff: document.getElementById("q-diff"),
    qId: document.getElementById("q-id"),
    qText: document.getElementById("q-text"),
    qOptions: document.getElementById("q-options"),
    qFeedback: document.getElementById("q-feedback"),
    btnSubmit: document.getElementById("btn-submit"),
    btnNext: document.getElementById("btn-next"),
    btnExit: document.getElementById("btn-exit"),
    resultTitle: document.getElementById("result-title"),
    resultScore: document.getElementById("result-score"),
    resultDetail: document.getElementById("result-detail"),
    resultWrongBlock: document.getElementById("result-wrong-block"),
    resultWrongList: document.getElementById("result-wrong-list"),
  };

  const typeLabel = { tf: "是非題", single: "選擇題", multi: "複選題" };

  function showView(name) {
    Object.entries(els.views).forEach(([key, el]) => {
      el.classList.toggle("is-visible", key === name);
    });
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function filterBank(mode) {
    let list = state.bank;
    if (mode === "tf" || mode === "single" || mode === "multi") {
      list = list.filter((q) => q.type === mode);
    }
    if (mode === "random" || mode === "exam") list = shuffle(list);
    if (mode === "exam") list = list.slice(0, Math.min(40, list.length));
    return list;
  }

  function startQuiz(mode) {
    state.mode = mode;
    state.instant = true;
    state.queue = filterBank(mode);
    state.index = 0;
    state.correct = 0;
    state.answered = 0;
    state.sessionWrongDetails = [];
    if (!state.queue.length) {
      alert("目前篩選條件下沒有題目。");
      return;
    }
    showView("quiz");
    renderQuestion();
  }

  function currentQuestion() {
    return state.queue[state.index];
  }

  function answersEqual(selected, answer) {
    if (selected.length !== answer.length) return false;
    const a = [...selected].sort((x, y) => x - y);
    const b = [...answer].sort((x, y) => x - y);
    return a.every((v, i) => v === b[i]);
  }

  function formatAnswer(q) {
    if (q.type === "tf") return q.answer ? "O（正確）" : "X（錯誤）";
    return q.answer.map((i) => `(${i + 1}) ${q.options[i]}`).join("、");
  }

  function formatSelected(q, selected) {
    if (q.type === "tf") {
      const v = selected[0];
      return v === 1 ? "O（正確）" : "X（錯誤）";
    }
    return selected
      .slice()
      .sort((a, b) => a - b)
      .map((i) => `(${i + 1}) ${q.options[i]}`)
      .join("、");
  }

  function renderQuestion() {
    const q = currentQuestion();
    state.selected = new Set();
    state.locked = false;
    els.qFeedback.hidden = true;
    els.qFeedback.textContent = "";
    els.btnSubmit.textContent = "送出答案";
    els.btnNext.hidden = true;
    els.btnNext.textContent =
      state.index >= state.queue.length - 1 ? "結束" : "下一題";
    // 是非／單選不需送出鈕；複選才顯示
    const needSubmit = q.type === "multi";
    els.btnSubmit.hidden = !needSubmit;
    els.btnSubmit.disabled = true;

    const total = state.queue.length;
    const pct = (state.index / total) * 100;
    els.progressFill.style.width = `${pct}%`;
    els.progressText.textContent = `${state.index + 1} / ${total}`;
    els.liveScore.textContent = state.answered
      ? `${Math.round((state.correct / state.answered) * 100)} 分`
      : "— 分";

    els.qType.textContent = typeLabel[q.type] || q.type;
    els.qDiff.textContent = q.difficulty;
    els.qId.textContent = q.id;
    els.qText.textContent = q.question;

    els.qOptions.innerHTML = "";
    if (q.type === "tf") {
      [
        { label: "O　正確", value: 1, key: "O" },
        { label: "X　錯誤", value: 0, key: "X" },
      ].forEach((opt) => {
        els.qOptions.appendChild(makeOption(opt.label, opt.value, false, opt.key));
      });
    } else {
      const multi = q.type === "multi";
      q.options.forEach((text, i) => {
        els.qOptions.appendChild(makeOption(text, i, multi, String(i + 1)));
      });
    }
  }

  function makeOption(text, value, multi, key) {
    const label = document.createElement("label");
    label.className = "option";
    const input = document.createElement("input");
    input.type = multi ? "checkbox" : "radio";
    input.name = "answer";
    input.value = String(value);
    const keyEl = document.createElement("span");
    keyEl.className = "option-key";
    keyEl.textContent = key;
    const span = document.createElement("span");
    span.textContent = text;
    label.append(input, keyEl, span);

    input.addEventListener("change", () => {
      if (state.locked) return;
      if (multi) {
        if (input.checked) state.selected.add(value);
        else state.selected.delete(value);
        label.classList.toggle("is-selected", input.checked);
        els.btnSubmit.disabled = state.selected.size === 0;
      } else {
        state.selected = new Set([value]);
        els.qOptions.querySelectorAll(".option").forEach((el) => el.classList.remove("is-selected"));
        label.classList.add("is-selected");
        els.btnSubmit.disabled = false;
        // 是非／單選：點選即送出
        submitAnswer();
      }
    });
    return label;
  }

  function getCorrectIndices(q) {
    if (q.type === "tf") return [q.answer ? 1 : 0];
    return [...q.answer];
  }

  function submitAnswer() {
    if (state.locked || state.selected.size === 0) return;
    const q = currentQuestion();
    state.locked = true;
    const selected = [...state.selected];
    const correct = getCorrectIndices(q);
    const ok = answersEqual(selected, correct);

    state.answered += 1;
    if (ok) {
      state.correct += 1;
    } else {
      state.sessionWrongDetails.push({
        id: q.id,
        question: q.question,
        type: q.type,
        difficulty: q.difficulty,
        yours: formatSelected(q, selected),
        correct: formatAnswer(q),
      });
    }

    const optionEls = [...els.qOptions.querySelectorAll(".option")];
    optionEls.forEach((el) => {
      const input = el.querySelector("input");
      input.disabled = true;
      const val = Number(input.value);
      if (correct.includes(val)) el.classList.add("is-correct");
      if (state.selected.has(val) && !correct.includes(val)) el.classList.add("is-wrong");
    });

    els.qFeedback.hidden = false;
    els.qFeedback.className = `feedback ${ok ? "ok" : "bad"}`;
    els.qFeedback.innerHTML = ok
      ? `答對了。`
      : `答錯了。正解：${formatAnswer(q)}`;

    els.btnSubmit.hidden = true;
    els.liveScore.textContent = `${Math.round((state.correct / state.answered) * 100)} 分`;

    if (ok) {
      nextQuestion();
      return;
    }

    els.btnNext.hidden = false;
    els.btnNext.textContent =
      state.index >= state.queue.length - 1 ? "結束" : "下一題";
    els.btnNext.focus();
  }

  function nextQuestion() {
    if (state.index >= state.queue.length - 1) {
      finishQuiz();
      return;
    }
    state.index += 1;
    renderQuestion();
  }

  function finishQuiz() {
    const score = state.answered
      ? Math.round((state.correct / state.answered) * 100)
      : 0;
    const passLine = state.mode === "exam" ? 70 : null;
    els.progressFill.style.width = "100%";
    showView("result");
    els.resultTitle.textContent =
      state.mode === "exam" ? (score >= 70 ? "模擬考及格" : "模擬考不及格") : "練習結束";
    els.resultScore.textContent = `${score} 分`;
    els.resultDetail.textContent =
      `答對 ${state.correct} / ${state.answered} 題` +
      (passLine != null ? `（及格線 ${passLine}%）` : "") +
      (state.sessionWrongDetails.length
        ? `，本回合錯 ${state.sessionWrongDetails.length} 題。`
        : "，全部答對！");

    if (state.sessionWrongDetails.length) {
      els.resultWrongBlock.hidden = false;
      els.resultWrongList.innerHTML = state.sessionWrongDetails
        .map(
          (item) => `<li>
          <div class="meta">${typeLabel[item.type]} · ${item.difficulty} · ${item.id}</div>
          <div>${item.question}</div>
          <div class="your-ans">你的答案：${item.yours}</div>
          <div class="correct-ans">正解：${item.correct}</div>
        </li>`
        )
        .join("");
    } else {
      els.resultWrongBlock.hidden = true;
      els.resultWrongList.innerHTML = "";
    }
  }

  function bindEvents() {
    document.querySelectorAll(".mode-card").forEach((card) => {
      card.addEventListener("click", () => startQuiz(card.dataset.mode));
    });

    els.btnSubmit.addEventListener("click", submitAnswer);
    els.btnNext.addEventListener("click", nextQuestion);
    els.btnExit.addEventListener("click", () => {
      if (confirm("確定離開目前練習？")) showView("home");
    });

    document.getElementById("btn-retry").addEventListener("click", () => startQuiz(state.mode));
    document.getElementById("btn-home").addEventListener("click", () => showView("home"));

    document.addEventListener("keydown", (e) => {
      if (!els.views.quiz.classList.contains("is-visible")) return;
      if (e.key === "Enter") {
        if (!els.btnSubmit.hidden && !els.btnSubmit.disabled) submitAnswer();
        else if (!els.btnNext.hidden) nextQuestion();
      }
    });
  }

  function init() {
    bindEvents();
    const data = window.QUESTION_BANK;
    if (!data || !Array.isArray(data.questions)) {
      throw new Error("題庫未載入");
    }
    state.bank = data.questions;
    state.meta = data.meta;
    els.totalCount.textContent = String(state.bank.length);
    els.countTf.textContent = `${state.bank.filter((q) => q.type === "tf").length} 題`;
    els.countSingle.textContent = `${state.bank.filter((q) => q.type === "single").length} 題`;
    els.countMulti.textContent = `${state.bank.filter((q) => q.type === "multi").length} 題`;
  }

  try {
    init();
  } catch (err) {
    console.error(err);
    document.body.innerHTML =
      `<p style="padding:24px;font-family:sans-serif">題庫載入失敗，請確認 js/questions.js 存在。</p>`;
  }
})();
