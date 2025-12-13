import React from "react";
export const noteT3 = ({ fill = "white" }) => {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4v8.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V8" fill="currentColor"/>
            <path d="M12 4v8.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V8" fill="currentColor"/>
            <circle cx="20" cy="6" r="2" fill="currentColor"/>
            <text x="2" y="8" fontSize="6" fill="currentColor">3</text>
        </svg>
    );
};