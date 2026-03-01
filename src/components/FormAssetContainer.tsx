import React from 'react';

interface FormAssetContainerProps {
    onDoubleClickAsset?: (url: string, type: string, meta?: any) => void;
}

const FORM_ELEMENTS = [
    {
        formType: 'text-input',
        label: 'Full Name',
        placeholder: 'Enter your name',
        icon: 'text_fields',
        title: 'Text Input',
        preview: () => (
            <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-gray-500">Full Name</span>
                <div className="flex items-center border border-gray-200 rounded-lg bg-white h-8 px-2.5">
                    <span className="text-[11px] text-gray-400">Enter your name</span>
                </div>
            </div>
        ),
    },
    {
        formType: 'email-input',
        label: 'Email Address',
        placeholder: 'you@example.com',
        icon: 'alternate_email',
        title: 'Email Input',
        preview: () => (
            <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-gray-500">Email Address</span>
                <div className="flex items-center border border-gray-200 rounded-lg bg-white h-8 px-2.5 gap-1.5">
                    <span className="material-symbols-outlined text-[12px] text-gray-300">alternate_email</span>
                    <span className="text-[11px] text-gray-400">you@example.com</span>
                </div>
            </div>
        ),
    },
    {
        formType: 'number-input',
        label: 'Quantity',
        placeholder: '0',
        icon: 'pin',
        title: 'Number Input',
        preview: () => (
            <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-gray-500">Quantity</span>
                <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden h-8">
                    <span className="flex-1 px-2.5 text-[11px] text-gray-400">0</span>
                    <div className="flex flex-col border-l border-gray-100 h-full">
                        <div className="flex-1 flex items-center justify-center px-1.5 text-[8px] text-gray-400 border-b border-gray-100">▲</div>
                        <div className="flex-1 flex items-center justify-center px-1.5 text-[8px] text-gray-400">▼</div>
                    </div>
                </div>
            </div>
        ),
    },
    {
        formType: 'textarea',
        label: 'Message',
        placeholder: 'Write your message...',
        rows: 4,
        icon: 'notes',
        title: 'Textarea',
        preview: () => (
            <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-gray-500">Message</span>
                <div className="border border-gray-200 rounded-lg bg-white h-14 px-2.5 py-1.5 flex items-start">
                    <span className="text-[11px] text-gray-400">Write your message...</span>
                </div>
            </div>
        ),
    },
    {
        formType: 'checkbox',
        label: 'I agree to the Terms & Conditions',
        icon: 'check_box',
        title: 'Checkbox',
        preview: () => (
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-gray-300 flex items-center justify-center bg-white shrink-0">
                </div>
                <span className="text-[10px] text-gray-600">I agree to the Terms & Conditions</span>
            </div>
        ),
    },
    {
        formType: 'select',
        label: 'Select an option',
        placeholder: 'Choose...',
        options: [{ label: 'Option 1', value: 'option1' }, { label: 'Option 2', value: 'option2' }, { label: 'Option 3', value: 'option3' }],
        icon: 'expand_circle_down',
        title: 'Select / Dropdown',
        preview: () => (
            <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-gray-500">Category</span>
                <div className="flex items-center justify-between border border-gray-200 rounded-lg bg-white h-8 px-2.5">
                    <span className="text-[11px] text-gray-400">Choose...</span>
                    <span className="material-symbols-outlined text-[14px] text-gray-300">expand_more</span>
                </div>
            </div>
        ),
    },
    {
        formType: 'radio',
        label: 'Choose an option',
        options: [{ label: 'Option A', value: 'a' }, { label: 'Option B', value: 'b' }],
        icon: 'radio_button_checked',
        title: 'Radio Button',
        preview: () => (
            <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-semibold text-gray-500">Choose an option</span>
                {['Option A', 'Option B'].map((opt, i) => (
                    <div key={opt} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center bg-white shrink-0">
                            {i === 0 && <div className="w-2 h-2 rounded-full bg-[#136c6c]" />}
                        </div>
                        <span className="text-[10px] text-gray-600">{opt}</span>
                    </div>
                ))}
            </div>
        ),
    },
    {
        formType: 'form-button',
        label: 'Submit',
        icon: 'touch_app',
        title: 'Submit Button',
        preview: () => (
            <div className="flex items-center justify-center bg-[#136c6c] rounded-lg h-9 px-4">
                <span className="text-[11px] font-bold text-white tracking-wide">Submit</span>
            </div>
        ),
    },
];

const DEFAULT_STYLE = {
    borderRadius: '8',
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    labelColor: '#374151',
    fontSize: '14',
    showLabel: true,
    labelPosition: 'top',
    required: false,
    disabled: false,
    helperText: '',
    errorMessage: '',
    name: '',
};

const FormAssetContainer: React.FC<FormAssetContainerProps> = ({ onDoubleClickAsset }) => {
    const buildMeta = (el: typeof FORM_ELEMENTS[0]) => ({
        ...DEFAULT_STYLE,
        formType: el.formType,
        label: el.label,
        placeholder: (el as any).placeholder || '',
        defaultValue: '',
        ...(el.formType === 'number-input' ? { min: '', max: '', step: '1', showSteppers: true, prefix: '', suffix: '' } : {}),
        ...(el.formType === 'textarea' ? { rows: (el as any).rows || 4, resize: 'vertical', maxLength: '' } : {}),
        ...(el.formType === 'checkbox' ? { defaultChecked: false, checkboxColor: '#136c6c', linkText: '', linkUrl: '' } : {}),
        ...(el.formType === 'select' ? {
            options: (el as any).options || [], defaultValue: '',
            optionBg: '#ffffff', optionText: '#111827',
            optionHoverBg: '#f0fdf4', optionHoverText: '#136c6c',
            optionSelectedBg: '#e6f4f1', dropdownRadius: '8', dropdownShadow: true,
        } : {}),
        ...(el.formType === 'text-input' ? { maxLength: '', prefix: '', suffix: '' } : {}),
        ...(el.formType === 'email-input' ? { showIcon: true, prefix: '', suffix: '' } : {}),
        ...(el.formType === 'radio' ? { options: (el as any).options || [], defaultValue: '', direction: 'vertical', radioColor: '#136c6c' } : {}),
        ...(el.formType === 'form-button' ? {
            buttonColor: '#136c6c', textColor: '#ffffff', fullWidth: true, fontWeight: '600', showLabel: false,
            endpoint: '', method: 'POST', submitFormat: 'json', submitFields: 'all',
            successMessage: '', errorMessage: '',
        } : {}),
    });

    const handleDragStart = (e: React.DragEvent, el: typeof FORM_ELEMENTS[0]) => {
        const meta = buildMeta(el);
        e.dataTransfer.setData('text/plain', el.label);
        e.dataTransfer.setData('assetType', 'form-input');
        e.dataTransfer.setData('fullMeta', JSON.stringify(meta));
        e.dataTransfer.effectAllowed = 'copy';

        const ghost = document.createElement('div');
        ghost.style.cssText = `position:fixed;top:-999px;left:-999px;width:220px;height:48px;border-radius:8px;background:#fff;border:1.5px solid #e5e7eb;display:flex;align-items:center;padding:0 12px;font-size:13px;color:#6b7280;font-family:system-ui;box-shadow:0 4px 12px rgba(0,0,0,0.1);`;
        ghost.textContent = el.title;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 110, 24);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    return (
        <div className="w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative">
            <div className="p-5 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-800">Form Elements</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Drag or double-click to add</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide flex flex-col gap-3">
                {FORM_ELEMENTS.map((el) => (
                    <div
                        key={el.formType}
                        className="bg-white border border-gray-100 rounded-xl overflow-hidden group cursor-pointer hover:border-primary/40 hover:shadow-md transition-all flex flex-col relative"
                        draggable
                        onDragStart={(e) => handleDragStart(e, el)}
                        onDoubleClick={() => onDoubleClickAsset?.(el.label, 'form-input', buildMeta(el))}
                    >
                        {/* Preview area */}
                        <div className="p-3 pb-2 pointer-events-none">
                            <el.preview />
                        </div>
                        {/* Footer */}
                        <div className="px-3 pb-2.5 flex items-center gap-1.5 pointer-events-none border-t border-gray-50 pt-2">
                            <span className="material-symbols-outlined text-[12px] text-primary">{el.icon}</span>
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{el.title}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FormAssetContainer;
