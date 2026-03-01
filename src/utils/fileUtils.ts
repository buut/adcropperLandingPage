export const cleanFileName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return sanitize(fileName);
    
    const name = fileName.substring(0, lastDotIndex);
    const ext = fileName.substring(lastDotIndex + 1);
    
    return `${sanitize(name)}.${ext.toLowerCase()}`;
};

const sanitize = (text: string): string => {
    const turkishChars: { [key: string]: string } = {
        'ç': 'c', 'Ç': 'C',
        'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ş': 's', 'Ş': 'S',
        'ü': 'u', 'Ü': 'U'
    };
    
    let result = text;
    
    // Replace Turkish characters
    Object.keys(turkishChars).forEach(char => {
        result = result.replace(new RegExp(char, 'g'), turkishChars[char]);
    });
    
    // Replace special characters and spaces
    result = result
        .replace(/\s+/g, '-')              // Replace spaces with -
        .replace(/[^a-zA-Z0-9-_]/g, '')    // Remove anything not alphanumeric, - or _
        .replace(/-+/g, '-')               // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '')           // Trim hyphens from start and end
        .toLowerCase();                    // Convert to lowercase
        
    return result || 'file';               // Fallback if empty
};
