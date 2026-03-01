import React from "react";

interface TimeLineItemNameProps {
  id: string;
  name: string;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onRename?: (id: string, newName: string) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  className?: string;
  depth?: number;
  isGroup?: boolean;
  isExpanded?: boolean;
  isMask?: boolean;
  onToggleExpand?: () => void;
  type?: string;
  showTextAnimationTrack?: boolean;
  onToggleTextAnimation?: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  icon?: string;
}

const TimeLineItemName: React.FC<TimeLineItemNameProps> = React.memo(
  ({
    id,
    name,
    isVisible = true,
    onToggleVisibility,
    onCopy,
    onPaste,
    onRename,
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    isSelected,
    onClick,
    isDragging,
    isDropTarget,
    className = "",
    depth = 0,
    isGroup = false,
    isExpanded = false,
    isMask = false,
    onToggleExpand,
    type,
    showTextAnimationTrack,
    onToggleTextAnimation,
    isLocked,
    onToggleLock,
    icon,
  }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(name);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (isEditing) {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }, [isEditing]);

    const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      setEditValue(name);
    };

    const handleBlur = () => {
      setIsEditing(false);
      if (editValue.trim() && editValue !== name) {
        onRename?.(id, editValue.trim());
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleBlur();
      } else if (e.key === "Escape") {
        setIsEditing(false);
        setEditValue(name);
      }
    };

    const getTypeConfig = (type?: string, isGroup?: boolean) => {
      if (isGroup)
        return { icon: "folder_open", color: "#3b82f6", bg: "bg-blue-50/50" };
      switch (type) {
        case "image":
          return { icon: "image", color: "#059669", bg: "bg-emerald-50/50" };
        case "video":
          return { icon: "movie", color: "#059669", bg: "bg-emerald-50/50" };
        case "button":
          return {
            icon: "smart_button",
            color: "#e11d48",
            bg: "bg-rose-50/50",
          };
        case "widget":
          return { icon: "widgets", color: "#7c3aed", bg: "bg-violet-50/50" };
        case "shape":
          return { icon: "pentagon", color: "#d97706", bg: "bg-amber-50/50" };
        case "text":
          return { icon: "title", color: "#4f46e5", bg: "bg-indigo-50/50" };
        default:
          return { icon: "draft", color: "#64748b", bg: "bg-slate-50/50" };
      }
    };

    const typeConfig = getTypeConfig(type, isGroup);

    return (
      <div
        className={`h-8 flex items-center px-2 border-b border-gray-100 hover:bg-gray-50/50 group relative ${isLocked ? "cursor-default opacity-60" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-30 bg-gray-100" : ""} ${isDropTarget ? "border-t-2 border-primary ring-1 ring-primary/20 bg-primary/5" : ""} ${isSelected ? "bg-primary/10 border-l-[3px] border-primary z-10" : ""} ${className}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >

        <div className="flex items-center w-4 shrink-0">
          {isGroup && (
            <button
              className="p-0.5 text-gray-400 hover:text-gray-700"
              style={{
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "12px" }}
              >
                chevron_right
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div
            className={`size-5 rounded flex items-center justify-center shrink-0 ${typeConfig.bg}`}
            style={{ color: typeConfig.color }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "13px" }}
            >
              {icon || typeConfig.icon}
            </span>
          </div>

          <div
            className="flex-1 flex items-center min-w-0"
            onDoubleClick={handleDoubleClick}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                className="w-full text-[10px] font-bold text-gray-700 bg-white border border-primary outline-hidden px-1 rounded-sm"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className={`text-[10px] font-bold cursor-pointer select-none flex items-center gap-1.5 ${isMask ? "text-primary" : "text-gray-700"} tracking-tight min-w-0 w-full`}
              >
                {isMask && (
                  <span
                    className="material-symbols-outlined shrink-0"
                    style={{ fontSize: "11px" }}
                  >
                    texture
                  </span>
                )}
                <span className="truncate">{name}</span>
              </span>
            )}
          </div>
        </div>

        {type === "text" && (
          <button
            className={`p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-gray-100 focus:outline-hidden ${showTextAnimationTrack ? "text-primary opacity-100 bg-primary/5" : "text-gray-400 hover:text-primary"}`}
            title="Add Text Animation"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTextAnimation?.();
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "15px" }}
            >
              title
            </span>
          </button>
        )}
        <button
          className={`p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isLocked ? "text-primary opacity-100" : "text-gray-400 hover:text-gray-700"}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.();
          }}
          title={isLocked ? "Unlock" : "Lock"}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "13px" }}
          >
            {isLocked ? "lock" : "lock_open"}
          </span>
        </button>
        <button
          className="p-1 text-gray-400 hover:text-gray-700 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility?.();
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "13px" }}
          >
            {isVisible ? "visibility" : "visibility_off"}
          </span>
        </button>
        <div className="flex items-center gap-1 mr-1">
          <button
            className="p-1 text-gray-400 hover:text-primary rounded hover:bg-gray-100 focus:outline-hidden"
            title="Copy"
            onClick={onCopy}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "13px" }}
            >
              content_copy
            </span>
          </button>
          <button
            className="p-1 text-gray-400 hover:text-primary rounded hover:bg-gray-100 focus:outline-hidden"
            title="Paste"
            onClick={onPaste}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "13px" }}
            >
              content_paste
            </span>
          </button>

        </div>
      </div>
    );
  },
);

export default TimeLineItemName;
