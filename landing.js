const button = document.querySelector("#copy");
const status = document.querySelector(".copy-status");
const code = document.querySelector("#snippet");

button.onclick = async () => {
  try {
    await navigator.clipboard.writeText(code.textContent);
    button.textContent = "복사됨";
    status.textContent = "코드를 클립보드에 복사했습니다.";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    status.textContent =
      "자동 복사를 할 수 없습니다. 코드를 선택해 두었으니 직접 복사하세요.";
  }
  setTimeout(() => (button.textContent = "복사"), 2000);
};
