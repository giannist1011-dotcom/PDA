// Line-art σουβλάκι (καλαμάκι): διαγώνια σούβλα με τρία κομμάτια κρέας.
// Ίδια συμπεριφορά με τα lucide icons — currentColor, props size/className.
// Πηγή artwork: frontend/src/assets/souvlaki_icon.svg
const SouvlakiIcon = ({ size = 24, className = "", ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <g transform="rotate(45 12 12)">
      <path d="M12 1v2" />
      <rect x="9" y="3" width="6" height="4" rx="1.2" />
      <path d="M12 7v1.5" />
      <rect x="9" y="8.5" width="6" height="4" rx="1.2" />
      <path d="M12 12.5v1.5" />
      <rect x="9" y="14" width="6" height="4" rx="1.2" />
      <path d="M12 18v5" />
    </g>
  </svg>
);

export default SouvlakiIcon;
