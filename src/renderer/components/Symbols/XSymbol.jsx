/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
/* eslint-disable import/prefer-default-export */
export function XSymbol({
    fill = 'currentColor',
    filled,
    size,
    height,
    width,
    label,
    ...props
}) {
    return (
        <svg
        width={size || width || 24}
        height={size || height || 24}
        viewBox="0 0 24 24"
        fill={filled ? fill : 'none'}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        >
        <path d="M9 9L15 15" stroke={fill}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"/>
        <path d="M15 9L9 15" stroke={fill}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="9" stroke={fill}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"/>
        </svg>
      );
}
