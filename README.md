# AdCropper Custom Widget System

The AdCropper Design Tool allows you to create custom widgets using HTML, CSS, and JavaScript. You can also define **Design Variables** (Properties) that can be edited directly from the Properties Bar, making your widgets reusable and dynamic.

## Using Properties in your Widget Script

When you define properties in the Widget Code Editor, they are automatically injected into your widget's runtime environment. You can access them via the `window` object in your JavaScript code.

### 1. `window.widgetValues` (Recommended)

This is a flat object where keys are the property names you defined, and values are their current settings.

**Example:**
If you added a property named `brandColor` (Color type) and `heroTitle` (Text type):

```javascript
// Accessing values
const color = window.widgetValues.brandColor;
const title = window.widgetValues.heroTitle;

// Using them in your widget
document.querySelector(".my-title").innerText = title;
document.querySelector(".container").style.backgroundColor = color;
```

### 2. `window.widgetProperties`

This is an array of the raw property objects, containing metadata like type and ID.

```javascript
// window.widgetProperties structure:
// [
//   { id: "prop_1", name: "brandColor", type: "color", value: "#3B82F6" },
//   ...
// ]

const brandColorProp = window.widgetProperties.find(
  (p) => p.name === "brandColor",
);
console.log(brandColorProp.value);
```

## Property Types

The following property types are supported and can be managed from the sidebar:

- **Text**: Simple string value.
- **Number**: Numeric value (useful for sizes, offsets, etc.).
- **Color**: Hex color string (managed via a color picker).
- **Font**: Font family name (managed via a font selector).
- **Select**: A dropdown list of predefined options.
- **Date**: A datetime string.

## Best Practices for Coding Widgets

1.  **Transparent Backgrounds**: Your widget body is rendered with `background: transparent`. Ensure your CSS doesn't force an opaque background unless intended.
2.  **Relative Sizing**: Use `100%` width and height for your main container so the widget scales correctly with the layer size in AdCropper.
3.  **Error Handling**: Wrap your JavaScript in `try/catch` blocks if you are performing complex operations to avoid breaking the preview.

---

_Generated for AdCropper Design Tool Documentation_
