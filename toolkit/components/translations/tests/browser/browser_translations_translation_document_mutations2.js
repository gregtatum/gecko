add_task(async function test_appending_element() {
  const { translate, htmlMatches, cleanup, document, resolveRequests } =
    await setupMutationsTest(/* html */ `
      <section>
        <div>block one</div>
        <div>block two</div>
        <div>block three</div>
      </section>
    `);

  translate();
  await resolveRequests();

  document.ownerGlobal.customElements.define(
    "app-login-widget",
    AppLoginWidget
  );

  console.log(`!!! AppLoginWidget`);
  /** @type {AppLoginWidget} */
  const loginWidget = new AppLoginWidget();
  console.log(`!!! loginWidget`, loginWidget.shadowRoot);

  const section = document.querySelector("section");
  const secondDiv = document.querySelectorAll("div")[1];
  section.insertBefore(loginWidget, secondDiv);

  await htmlMatches(
    "Multiple elements are inserted at once",
    /* html */ `
      <section>
        <div>
          b̅l̅o̅c̅k̅ o̅n̅e̅ (id:1)
        </div>
        <app-login-widget>
        </app-login-widget>
        <div>
          b̅l̅o̅c̅k̅ t̅w̅o̅ (id:2)
        </div>
        <div>
          b̅l̅o̅c̅k̅ t̅h̅r̅e̅e̅ (id:3)
        </div>
      </section>
    `
  );

  console.log(
    `!!! loginWidget.shadowRoot`,
    loginWidget,
    loginWidget.shadowRoot.children
  );

  await htmlMatches(
    "The shadowroot also matches",
    /* html */ `asdf`,
    loginWidget.shadowRoot
  );

  await doubleRaf(document);
  let translationsCount = await resolveRequests();
  is(translationsCount, 2, "The two block elements were translated");

  await htmlMatches(
    "Multiple elements are inserted at once",
    /* html */ `

    `
  );

  cleanup();
});

class AppLoginWidget extends HTMLElement {
  constructor() {
    super();
    console.log(`!!! AppLoginWidget constructor`);

    // Create a shadow root
    const shadow = this.attachShadow({ mode: "open" });

    // Create form elements
    const form = document.createElement("form");
    form.setAttribute("novalidate", "");

    const usernameInput = document.createElement("input");
    usernameInput.setAttribute("type", "text");
    usernameInput.setAttribute("name", "username");
    usernameInput.setAttribute("placeholder", "Spielername");
    usernameInput.setAttribute("aria-label", "Spielername");
    usernameInput.setAttribute("autocomplete", "username");
    usernameInput.setAttribute("required", "");
    usernameInput.classList.add("uk-input", "uk-form-small");

    const passwordInput = document.createElement("input");
    passwordInput.setAttribute("type", "password");
    passwordInput.setAttribute("name", "password");
    passwordInput.setAttribute("placeholder", "Passwort");
    passwordInput.setAttribute("aria-label", "Passwort");
    passwordInput.setAttribute("autocomplete", "current-password");
    passwordInput.setAttribute("required", "");
    passwordInput.classList.add("uk-input", "uk-form-small");

    const submitButton = document.createElement("button");
    submitButton.setAttribute("type", "submit");
    submitButton.textContent = "Einloggen";
    submitButton.classList.add(
      "uk-button",
      "uk-button-small",
      "uk-button-default"
    );

    // Append inputs to the form
    form.appendChild(usernameInput);
    form.appendChild(passwordInput);
    form.appendChild(submitButton);

    // Apply styles
    const style = document.createElement("style");
    style.textContent = `
      .uk-input {
        margin-bottom: 8px;
        width: 100%;
      }
      .uk-button {
        width: 100%;
      }
    `;

    // Attach the created elements to the shadow DOM
    shadow.appendChild(style);
    shadow.appendChild(form);
    console.log(`!!! shadow created`, shadow);
  }
}
