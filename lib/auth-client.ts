export async function sessionFetch(input:RequestInfo|URL,init?:RequestInit){const response=await fetch(input,{...init,cache:'no-store',credentials:'same-origin'});if(response.status===401)window.dispatchEvent(new Event('ruanruan:session-expired'));return response}

