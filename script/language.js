const availableLanguages = [
  { code: "de", label: "Deutsch (Standard)", smallabel: "Deutsch" },
  { code: "en", label: "English", smallabel: "Englisch" },
  { code: "es", label: "Español", smallabel: "Spanisch" },
  { code: "fr", label: "Français", smallabel: "Französisch"}
];

const container = document.getElementById("language-options");
const currentLang = localStorage.getItem("app_lang") || "de";

container.innerHTML = availableLanguages.map(lang => `
  <div class="language-option" data-lang="${lang.code}">
    <input type="radio" name="language" id="lang-${lang.code}" value="${lang.code}" ${lang.code === currentLang ? "checked" : ""}>
    <label for="lang-${lang.code}">
      <b>${lang.label}</b><br>
      <small class="secondary">${lang.smallabel}</small>
    </label>
  </div>
`).join("");

container.addEventListener("click", (e) => {
  const optionDiv = e.target.closest(".language-option");
  if (!optionDiv) return;

  const langCode = optionDiv.dataset.lang;
  localStorage.setItem("app_lang", langCode);
  location.reload();
});