require('dotenv').config()

const supabase = require('./config/supabaseClient')

async function testConnection() {

  const { data, error } = await supabase
    .from('snags')
    .select('*')

  if (error) {
    console.log("Error:", error)
  } else {
    console.log("Data:", data)
  }
}

testConnection()