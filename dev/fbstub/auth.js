let cb=null,cur=null;export const getAuth=()=>({});export const browserLocalPersistence={};export const setPersistence=()=>Promise.resolve();
export const onAuthStateChanged=(a,f)=>{cb=f;setTimeout(()=>f(cur),10)};
export const signInWithEmailAndPassword=(a,e,p)=>p==='pw'?(cur={email:e},setTimeout(()=>cb(cur),10),Promise.resolve({user:cur})):Promise.reject({code:'auth/invalid-credential'});
export const signOut=()=>{cur=null;setTimeout(()=>cb(null),10);return Promise.resolve()};
export const sendPasswordResetEmail=()=>Promise.resolve();
