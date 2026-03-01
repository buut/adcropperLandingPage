import { useEffect } from 'react';

/**
 * Global behavior: when user holds middle mouse button (wheel click) on a number input
 * and moves the mouse left/right, the input value is decreased/increased.
 */
export function useNumberInputWheelDrag() {
  useEffect(() => {
    let activeInput: HTMLInputElement | null = null;
    let startX = 0;
    let startValue = 0;
    let useLeftButton = false;
    let pendingLeft: { input: HTMLInputElement; downX: number; downY: number } | null = null;
    const sensitivity = 0.2; // 5 pixels ≈ 1 unit
    const leftButtonDragThresholdPx = 5;

    const getInput = (el: EventTarget | null): HTMLInputElement | null => {
      if (!el || !(el instanceof Node)) return null;
      const node = el as HTMLElement;
      if (node.tagName === 'INPUT') {
        const input = node as HTMLInputElement;
        if (input.type === 'number' || input.getAttribute('data-number-wheel-drag') === 'true') return input;
        return null;
      }
      const selector = 'input[type="number"], input[data-number-wheel-drag="true"]';
      const inside = node.querySelector?.(selector);
      if (inside instanceof HTMLInputElement) return inside;
      const ancestor = node.closest?.(selector);
      return ancestor instanceof HTMLInputElement ? ancestor : null;
    };

    const parseNum = (v: string): number => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };

    const applyValue = (input: HTMLInputElement, value: number) => {
      const min = input.min !== '' ? parseNum(input.min) : -Infinity;
      const max = input.max !== '' ? parseNum(input.max) : Infinity;
      const step = input.step !== '' && input.step !== 'any' ? parseNum(input.step) : 1;
      const clamped = Math.min(max, Math.max(min, value));
      const rounded = step === 0 ? clamped : Math.round(clamped / step) * step;
      const fixed = Number.isInteger(step) && step >= 1 ? Math.round(rounded) : Math.round(rounded * 100) / 100;
      const final = Math.min(max, Math.max(min, fixed));
      const str = input.type === 'number' ? String(final) : (Number.isInteger(final) ? String(Math.round(final)) : String(final));
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, str);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        input.value = str;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const onMouseDown = (e: MouseEvent) => {
      const isMiddle = e.button === 1;
      const isLeft = e.button === 0;
      if (!isMiddle && !isLeft) return;
      const input = getInput(e.target);
      if (!input || input.disabled || input.readOnly) return;
      if (isMiddle) {
        e.preventDefault();
        activeInput = input;
        startX = e.clientX;
        startValue = parseNum(input.value);
        useLeftButton = false;
      } else {
        pendingLeft = { input, downX: e.clientX, downY: e.clientY };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (pendingLeft && (e.buttons & 1)) {
        const dx = Math.abs(e.clientX - pendingLeft.downX);
        if (dx >= leftButtonDragThresholdPx) {
          const inp = pendingLeft.input;
          pendingLeft = null;
          e.preventDefault();
          activeInput = inp;
          startX = e.clientX;
          startValue = parseNum(inp.value);
          useLeftButton = true;
        }
      }
      if (!activeInput) return;
      const middleHeld = (e.buttons & 2) !== 0;
      const leftHeld = useLeftButton && (e.buttons & 1) !== 0;
      if (!middleHeld && !leftHeld) {
        activeInput = null;
        return;
      }
      e.preventDefault();
      const deltaX = (e.clientX - startX) * sensitivity;
      const value = startValue + deltaX;
      applyValue(activeInput, value);
    };

    const onMouseUp = () => {
      activeInput = null;
      useLeftButton = false;
      pendingLeft = null;
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('mouseleave', onMouseUp, true);

    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('mouseleave', onMouseUp, true);
    };
  }, []);
}
