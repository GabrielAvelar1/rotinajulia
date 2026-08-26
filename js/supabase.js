// Configuração do Supabase
const SUPABASE_URL = 'https://nscwgutnytrbytlzzvil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zY3dndXRueXRyYnl0bHp6dmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2Mjk5ODcsImV4cCI6MjEwMDIwNTk4N30.cTzm3Hs2aov367E2uFBT4ZDyUZQNmvhF5yF-5hZyPUA';

// Inicializa o cliente Supabase (CDN carrega a lib em window.supabase)
const _supabaseLib = window.supabase;
const supabaseClient = _supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY);

// Expõe o cliente globalmente para todos os módulos
window.supabase = supabaseClient;

// === Funções de Autenticação ===

// Login com email e senha
async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Logout
async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

// Obter usuário atual
async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}
window.getCurrentUser = getCurrentUser;

// Listener de mudança de auth
function onAuthStateChange(callback) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// === Funções de Upload (Supabase Storage) ===

async function uploadImage(file, path) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${path}/${Date.now()}.${fileExt}`;
  const { data, error } = await supabaseClient.storage.from('images').upload(fileName, file);
  if (error) throw error;
  const { data: urlData } = supabaseClient.storage.from('images').getPublicUrl(fileName);
  return urlData.publicUrl;
}
window.uploadImage = uploadImage;
