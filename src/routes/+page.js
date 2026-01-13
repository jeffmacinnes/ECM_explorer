/* since there's no dynamic data here, we can prerender  it so that it 
gets served as a static asset in production.

Also, if there is a +page.server.js file that is reading data from the file system, 
pre-render must also be set to true */
export const prerender = true;
