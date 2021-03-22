export class Range extends HTMLElement {
  constructor(label, min, max, step, value) {
    super();

    this.className = "range";

    let template = document.getElementById("template-range");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".range-label").textContent = label;
    this.display = fragment.querySelector(".range-value");
    this.slider = fragment.querySelector(".range-slider");
    this.slider.setAttribute("min", min);
    this.slider.setAttribute("max", max);
    this.slider.setAttribute("step", step);
    this.slider.setAttribute("value", value);

    this.slider.addEventListener("input", () => this.updateValue());
    this.appendChild(fragment);

    this.updateValue();
  }

  get value() {
    return this.slider.valueAsNumber;
  }

  updateValue() {
    this.display.textContent = this.value.toFixed(1);
  }
}

customElements.define("e-range", Range);
