/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
/* eslint-disable import/prefer-default-export */
export function UploadSymbol({
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
        <path d="M16 12L12 8M12 8L8 12M12 8V16M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke={fill}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"/>
        </svg>
      );
}
