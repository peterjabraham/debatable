import React from 'react';

// Mock Tabs components
export const Tabs = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const TabsList = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const TabsTrigger = ({ children, ...props }: any) => <button {...props}>{children}</button>;
export const TabsContent = ({ children, ...props }: any) => <div {...props}>{children}</div>;

// Mock Collapsible components
export const Collapsible = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const CollapsibleTrigger = ({ children, ...props }: any) => <button {...props}>{children}</button>;
export const CollapsibleContent = ({ children, ...props }: any) => <div {...props}>{children}</div>; 