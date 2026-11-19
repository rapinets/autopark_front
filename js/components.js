export function pageHeader(title, description = "") {
  const heading = document.createElement("h1");
  heading.textContent = title;
  heading.tabIndex = -1;

  const wrapper = document.createElement("header");
  wrapper.className = "page-header";
  wrapper.append(heading);

  if (description) {
    const text = document.createElement("p");
    text.className = "page-description";
    text.textContent = description;
    wrapper.append(text);
  }

  return wrapper;
}

export function message(text, type = "") {
  const element = document.createElement("div");
  element.className = `message${type ? ` message-${type}` : ""}`;
  element.setAttribute("role", type === "error" ? "alert" : "status");
  element.textContent = text;
  return element;
}

export function skeleton() {
  const block = document.createElement("div");
  block.className = "state-block";
  block.setAttribute("aria-busy", "true");
  block.setAttribute("aria-label", "Завантаження");
  for (let i = 0; i < 4; i += 1) {
    const line = document.createElement("div");
    line.className = "skeleton";
    block.append(line);
  }
  return block;
}

export function stateBlock(text, type = "") {
  const block = document.createElement("div");
  block.className = `state-block${type ? ` ${type}` : ""}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  block.append(paragraph);
  return block;
}

export function confirmDialog(title, text, confirmText = "Підтвердити") {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog";

    const heading = document.createElement("h2");
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = text;
    const actions = document.createElement("div");
    actions.className = "dialog-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "button button-secondary";
    cancel.textContent = "Скасувати";

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "button button-danger";
    confirm.textContent = confirmText;

    actions.append(cancel, confirm);
    dialog.append(heading, description, actions);
    document.body.append(dialog);

    const initiator = document.activeElement;
    const close = (value) => {
      dialog.close();
      dialog.remove();
      if (initiator instanceof HTMLElement) {
        initiator.focus();
      }
      resolve(value);
    };

    cancel.addEventListener("click", () => close(false));
    confirm.addEventListener("click", () => close(true));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close(false);
    });

    dialog.showModal();
    cancel.focus();
  });
}
