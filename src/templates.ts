export const templateCategories = ['replies','business-card','services','opening-hours','contact-details'] as const;
export type TemplateCategory = typeof templateCategories[number];
export type Template = {id:string;title:string;text:string;category?:TemplateCategory};
export const categoryLabels: Record<TemplateCategory,string> = {replies:'Reply templates','business-card':'Business card',services:'Services','opening-hours':'Opening hours','contact-details':'Contact details'};
export const categoryStarters: Record<TemplateCategory,{title:string;text:string}> = {
 replies:{title:'',text:''},
 'business-card':{title:'Business card',text:'Business name: \nAbout: \nPhone: \nEmail: \nWebsite: \nAddress: '},
 services:{title:'Our services',text:'Services:\n• \n• \n• '},
 'opening-hours':{title:'Opening hours',text:'Monday–Friday: \nSaturday: \nSunday: \nTimezone: '},
 'contact-details':{title:'Contact details',text:'Contact name: \nPhone: \nEmail: \nWebsite: \nAddress: '},
};
