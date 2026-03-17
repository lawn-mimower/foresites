
const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const { createObjectCsvWriter } = require('csv-writer');
const { uploadToS3, getS3Url } = require('./s3');
const { supabase } = require('./db');

// Environment Variables
const accessToken = process.env.accessToken;
const phone_number_id = process.env.phone_number_id;
const apiVersion = 'v25.0';

if (!accessToken || !phone_number_id) {
  console.warn('⚠️ Missing WhatsApp API credentials — please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.');
}

// State Holders
const userStates = {};
const processedMessages = new Set();

// -------------------- Helper Function --------------------
// 🔍 LOOKUP USER BY PHONE NUMBER IN website_user TABLE
async function getUserByPhoneNumber(phoneNumber) {
  try {
    // Extract only digits from phone number for matching
    // DB stores numbers WITH country code (e.g. "918007953471"), so keep it
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    console.log(`🔍 Looking up phone number: ${cleanPhone} in website_user table...`);
    
    // Query Supabase for the phone number in website_user table
    const { data: user, error } = await supabase
      .from('website_user')
      .select('user_id, username, email, role, department, designation, phone_number')
      .eq('phone_number', cleanPhone)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No matching row found - this is expected
        console.log(`⚠️ No user found for phone: ${cleanPhone}`);
        return null;
      }
      console.error('❌ Error querying website_user:', error);
      return null;
    }
    
    if (user) {
      console.log(`✅ User found: ${user.username} (ID: ${user.user_id})`);
    }
    
    return user;
  } catch (err) {
    console.error('❌ getUserByPhoneNumber error:', err);
    return null;
  }
}

// -------------------- Helper Functions --------------------
// 🎤 TRANSCRIBE VOICE AUDIO
async function getTranscription(audioFilePath) {
  try {
    // Read the audio file from disk
    // audioFilePath can be either S3 key (voice/filename.ogg) or local path (/uploads/voice/filename.ogg)
    console.log(`📝 Reading audio file for transcription: ${audioFilePath}...`);
    
    let audioFile;
    // Check if it's an S3 key (starts with voice/ or images/) or local path
    if (audioFilePath.startsWith('voice/') || audioFilePath.startsWith('images/')) {
      // It's an S3 key, read from local uploads folder (file was saved locally before S3 upload)
      const localPath = path.join(__dirname, '../uploads', audioFilePath);
      audioFile = fs.readFileSync(localPath);
    } else {
      // It's a local path, resolve from project root
      const cleanPath = audioFilePath.startsWith('/') ? audioFilePath.substring(1) : audioFilePath;
      audioFile = fs.readFileSync(path.resolve(__dirname, '..', cleanPath));
    }

    // Convert the file buffer to a Base64 string
    const audioBase64 = audioFile.toString('base64');
    console.log('✅ File converted to Base64.');

    // Determine MIME type based on file extension
    const ext = path.extname(audioFilePath).toLowerCase();
    const mimeTypes = {
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
    };
    const mimeType = mimeTypes[ext] || 'audio/wav';

    // Create the JSON payload
    const payload = {
      mime_type: mimeType,
      audio_base64: audioBase64,
    };

    // API endpoint from voice_test.js
    const API_ENDPOINT_URL = 'https://u91h1twf00.execute-api.eu-north-1.amazonaws.com/default/IssueTranscribe';

    // Send the POST request to the API Gateway
    console.log(`📤 Sending transcription request to API...`);
    const response = await axios.post(API_ENDPOINT_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 seconds
    });

    // Extract transcription from response
    const transcription = response.data?.transcription || '';
    console.log('✅ Transcription received:', transcription.substring(0, 50) + '...');
    return transcription;
  } catch (error) {
    console.error('❌ Transcription error:', error.response?.data || error.message);
    return null; // Return null on error so the flow can continue
  }
}

async function sendText(to, body) {
  try {
    await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phone_number_id}/messages`,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body } },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    console.log(`➡️ Sent text to ${to}: ${body.replace(/\n/g, ' | ')}`);
  } catch (e) {
    console.error('❌ sendText error:', e.response?.data || e.message);
  }
}

async function sendList(to, header, body, options = []) {
  try {
    const cleanOptions = options.map(o => ({
      id: o.id || 'unknown',
      title: (o.title || 'Unnamed').substring(0, 24),
    }));

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: header.substring(0, 24) },
        body: { text: body },
        action: { button: 'Select', sections: [{ title: 'Choose One', rows: cleanOptions }] },
      },
    };

    await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phone_number_id}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('➡️ Sent list:', header);
  } catch (e) {
    console.error('❌ sendList error:', e.response?.data || e.message);
  }
}

// 📥 DOWNLOAD MEDIA (voice/image), SAVE LOCALLY, AND UPLOAD TO S3
async function downloadMedia(mediaId, folderName, userName = 'anonymous') {
  try {
    const metaRes = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const mediaUrl = metaRes.data.url;
    if (!mediaUrl) throw new Error('No media URL found');

    const mediaRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    });

    const contentType = mediaRes.headers['content-type'] || 'application/octet-stream';
    const ext = contentType.split('/')[1]?.split(';')[0] || 'bin';
    const dir = path.join(__dirname, '../uploads', folderName);
    await fsPromises.mkdir(dir, { recursive: true });

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = userName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${dateStr}_${safeName}.${ext}`;
    const filePath = path.join(dir, filename);

    // Save locally first (needed for transcription)
    await fsPromises.writeFile(filePath, mediaRes.data);
    console.log(`✅ Saved ${folderName} locally: ${filePath}`);

    // Upload to S3
    const bucketName = process.env.S3_BUCKET_NAME;
    console.log(`🪣 S3_BUCKET_NAME: ${bucketName}`);
    
    if (bucketName) {
      try {
        console.log(`📤 Uploading ${folderName} to S3 bucket: ${bucketName}`);
        const s3Key = await uploadToS3(filePath, bucketName, `${folderName}/`);
        console.log(`✅ Successfully uploaded to S3. Key: ${s3Key}`);
        
        // Convert S3 key to full S3 URL
        const s3Url = getS3Url(s3Key, bucketName);
        console.log(`🔗 S3 URL: ${s3Url}`);
        
        // Return full S3 URL for database storage
        return s3Url;
      } catch (s3Error) {
        console.error('❌ S3 upload failed:', s3Error.message);
        console.error('❌ Stack:', s3Error.stack);
        throw s3Error;  // Re-throw to fail instead of falling back
      }
    } else {
      throw new Error('S3_BUCKET_NAME not configured in environment variables');
    }
  } catch (err) {
    console.error('❌ downloadMedia error:', err.response?.data || err.message);
    return null;
  }
}

// -------------------- Steps --------------------
const steps = {
  askName: async (from, user, msgObj, text) => {
    user.feedback.reporter_name = text;
    user.feedback.user_id = user.registeredUser?.user_id || null; // Set user_id if registered, null for new users
    user.step = 'askSite';
    
    // Fetch sites from Supabase
    const { data: sites, error } = await supabase.from('site').select('id, site_name').limit(20);
    
    if (error) {
      console.error('❌ Error fetching sites:', error);
      return sendText(from, '⚠️ Error loading sites. Please try again.');
    }
    
    console.log('📍 Sites fetched:', sites);
    
    const opts = sites && sites.length > 0
      ? sites.map(s => ({ id: s.site_name, title: s.site_name }))
      : [{ id: 'Site Alpha', title: 'Site Alpha' }];
    
    console.log('📋 Options to display:', opts);
    await sendList(from, 'Site Name', 'Please choose your site name:', opts);
  },

  // ========== MAIN MENU HANDLER ==========
  awaitMainMenuChoice: async (from, user, msgObj, text) => {
    if (text === 'report_snag') {
      // Start the snag reporting flow
      user.step = 'reportSnag';
      await steps.reportSnag(from, user);
    } else if (text === 'view_snags') {
      // View snags flow
      user.step = 'viewSnags';
      await steps.viewSnags(from, user);
    } else if (text === 'add_todo') {
      // Add todo flow
      user.step = 'addTodoItem';
      await steps.addTodoItem(from, user);
    } else if (text === 'view_todos') {
      // View todos flow
      user.step = 'viewTodos';
      await steps.viewTodos(from, user);
    } else if (text === 'update_todo') {
      // Update todo flow
      user.step = 'updateTodoList';
      await steps.updateTodoList(from, user);
    } else {
      await sendText(from, '⚠️ Invalid choice. Please select from the menu.');
    }
  },

  reportSnag: async (from, user) => {
    // Start the regular snag reporting flow
    user.step = 'askSite';
    await sendText(from, '📝 Let\'s report a snag. Please select your site:');
    
    // Fetch and show sites
    const { data: sites, error } = await supabase.from('site').select('id, site_name').limit(20);
    
    if (error) {
      console.error('❌ Error fetching sites:', error);
      return sendText(from, '⚠️ Error loading sites. Please try again.');
    }
    
    console.log('📍 Sites fetched:', sites);
    
    const opts = sites && sites.length > 0
      ? sites.map(s => ({ id: s.site_name, title: s.site_name }))
      : [{ id: 'Site Alpha', title: 'Site Alpha' }];
    
    console.log('📋 Options to display:', opts);
    await sendList(from, 'Site Name', 'Please choose your site name:', opts);
  },

  viewSnags: async (from, user) => {
    try {
      // Fetch user's snags from database
      const userId = user.feedback.user_id;
      
      const { data: snags, error } = await supabase
        .from('snag')
        .select('id, category, feedback_type, status, created_at')
        .eq('phone_number', from.replace(/\D/g, '').slice(-10))
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching snags:', error);
        return sendText(from, '⚠️ Error loading your snags.');
      }
      
      if (!snags || snags.length === 0) {
        await sendText(from, '📋 You have no snags recorded yet.');
      } else {
        let message = `📋 Your Snags (${snags.length}):\n\n`;
        snags.forEach((snag, index) => {
          const date = new Date(snag.created_at).toLocaleDateString();
          message += `${index + 1}. ${snag.category} - ${snag.status} (${date})\n`;
        });
        await sendText(from, message);
      }
      
      user.step = 'awaitMainMenuChoice';
      await sendText(from, '\n\nWhat would you like to do next?');
      await sendList(from, 'Main Menu', 'Choose an option:', [
        { id: 'report_snag', title: 'Report a Snag' },
        { id: 'view_snags', title: 'View My Snags' },
        { id: 'add_todo', title: 'Add to Todo List' },
        { id: 'view_todos', title: 'View Pending Todos' },
        { id: 'update_todo', title: 'Mark Todo Complete' },
      ]);
    } catch (err) {
      console.error('❌ viewSnags error:', err);
      await sendText(from, '⚠️ Error loading your snags. Please try again.');
    }
  },

  viewTodos: async (from, user) => {
    try {
      // Fetch user's pending todos from database
      const userId = user.feedback.user_id;
      
      const { data: todos, error } = await supabase
        .from('todo')
        .select('id, action_item, status, open_date, expected_closing_date, notes')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('expected_closing_date', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching todos:', error);
        return sendText(from, '⚠️ Error loading your todo list.');
      }
      
      if (!todos || todos.length === 0) {
        await sendText(from, '✓ No pending todo items.');
      } else {
        let message = `* Pending Todos (${todos.length})\n\n`;
        todos.forEach((todo, index) => {
          const openDate = todo.open_date ? new Date(todo.open_date).toLocaleDateString() : 'N/A';
          const closeDate = todo.expected_closing_date ? new Date(todo.expected_closing_date).toLocaleDateString() : 'N/A';
          
          message += `${index + 1}. ${todo.action_item}\n`;
          message += `   Start: ${openDate} | Due: ${closeDate}\n`;
          if (todo.notes) {
            message += `   Note: ${todo.notes}\n`;
          }
          message += `\n`;
        });
        await sendText(from, message);
      }
      
      user.step = 'awaitMainMenuChoice';
      await sendText(from, 'What would you like to do next?');
      await sendList(from, 'Main Menu', 'Choose an option:', [
        { id: 'report_snag', title: 'Report a Snag' },
        { id: 'view_snags', title: 'View My Snags' },
        { id: 'add_todo', title: 'Add to Todo List' },
        { id: 'view_todos', title: 'View Pending Todos' },
        { id: 'update_todo', title: 'Mark Todo Complete' },
      ]);
    } catch (err) {
      console.error('❌ viewTodos error:', err);
      await sendText(from, '⚠️ Error loading your todos. Please try again.');
    }
  },

  updateTodoList: async (from, user) => {
    try {
      // Fetch user's pending todos for selection
      const userId = user.feedback.user_id;
      
      const { data: todos, error } = await supabase
        .from('todo')
        .select('id, action_item, expected_closing_date')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('expected_closing_date', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching todos:', error);
        return sendText(from, '⚠️ Error loading your todos.');
      }
      
      if (!todos || todos.length === 0) {
        await sendText(from, '✓ No pending todos to complete.');
        user.step = 'awaitMainMenuChoice';
        await sendList(from, 'Main Menu', 'What would you like to do?', [
          { id: 'report_snag', title: 'Report a Snag' },
          { id: 'view_snags', title: 'View My Snags' },
          { id: 'add_todo', title: 'Add to Todo List' },
          { id: 'view_todos', title: 'View Pending Todos' },
          { id: 'update_todo', title: 'Mark Todo Complete' },
        ]);
        return;
      }
      
      // Create list of todos for selection
      const todoOptions = todos.map(todo => ({
        id: todo.id.toString(),
        title: todo.action_item.substring(0, 24),
      }));
      
      user.step = 'awaitTodoSelection';
      user.pendingTodos = todos; // Store todos for reference
      await sendList(from, 'Mark Complete', 'Select a todo to mark as completed:', todoOptions);
    } catch (err) {
      console.error('❌ updateTodoList error:', err);
      await sendText(from, '⚠️ Error. Please try again.');
    }
  },

  awaitTodoSelection: async (from, user, msgObj, text) => {
    try {
      // Find the selected todo
      const selectedTodo = user.pendingTodos.find(t => t.id.toString() === text);
      
      if (!selectedTodo) {
        return sendText(from, '⚠️ Invalid selection. Please try again.');
      }
      
      // Update the todo status to completed
      const { data: updated, error } = await supabase
        .from('todo')
        .update({ status: 'completed', closed_date: new Date().toISOString() })
        .eq('id', selectedTodo.id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating todo:', error);
        return sendText(from, '⚠️ Error marking todo complete. Please try again.');
      }
      
      console.log('✅ Todo marked as completed:', updated);
      await sendText(from, `✅ Great! "${selectedTodo.action_item}" is now complete!`);
      
      user.step = 'awaitMainMenuChoice';
      await sendText(from, '\n\nWhat would you like to do next?');
      await sendList(from, 'Main Menu', 'Choose an option:', [
        { id: 'report_snag', title: 'Report a Snag' },
        { id: 'view_snags', title: 'View My Snags' },
        { id: 'add_todo', title: 'Add to Todo List' },
        { id: 'view_todos', title: 'View Pending Todos' },
        { id: 'update_todo', title: 'Mark Todo Complete' },
      ]);
      
      // Clear pending todos
      delete user.pendingTodos;
    } catch (err) {
      console.error('❌ awaitTodoSelection error:', err);
      await sendText(from, '⚠️ Error. Please try again.');
    }
  },

  addTodoItem: async (from, user) => {
    try {
      user.step = 'awaitTodoActionItem';
      user.todoData = {}; // Initialize todo data object
      await sendText(from, '✅ Let\'s add a new todo item.\n\nWhat is the action item? (Type the task):');
    } catch (err) {
      console.error('❌ addTodoItem error:', err);
      await sendText(from, '⚠️ Error. Please try again.');
    }
  },

  awaitTodoActionItem: async (from, user, msgObj, text) => {
    try {
      user.todoData.action_item = text;
      user.step = 'awaitTodoNotes';
      await sendText(from, '📝 Any notes for this task? (Type notes or "skip"):');
    } catch (err) {
      console.error('❌ awaitTodoActionItem error:', err);
      await sendText(from, '⚠️ Error. Please try again.');
    }
  },

  awaitTodoNotes: async (from, user, msgObj, text) => {
    try {
      user.todoData.notes = text.toLowerCase() === 'skip' ? null : text;
      
      // Auto-set open_date to today
      const today = new Date();
      user.todoData.open_date = today.toISOString();
      
      console.log(`📅 Open date set to today: ${today.toDateString()}`);
      
      user.step = 'awaitTodoClosingDate';
      
      // Generate next 7 days for selection
      const closingDateOptions = [];
      for (let i = 1; i <= 7; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + i);
        const dateStr = futureDate.toISOString().split('T')[0];
        const dateDisplay = futureDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        closingDateOptions.push({ id: dateStr, title: dateDisplay });
      }
      
      // Add custom date option
      closingDateOptions.push({ id: 'custom_date', title: '📝 Enter Custom Date' });
      
      await sendList(from, 'Closing Date', 'When should this be completed by?', closingDateOptions);
    } catch (err) {
      console.error('❌ awaitTodoNotes error:', err);
      await sendText(from, '⚠️ Error. Please try again.');
    }
  },

  awaitTodoClosingDate: async (from, user, msgObj, text) => {
    try {
      // Check if it's a custom date selection
      if (text === 'custom_date') {
        user.step = 'awaitCustomClosingDate';
        return sendText(from, '📅 Enter the completion date (YYYY-MM-DD format):');
      }
      
      // Otherwise, it's a selected date from the list
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(text)) {
        user.todoData.expected_closing_date = new Date(text).toISOString();
        // Now save the complete todo item
        await steps.saveTodoItem(from, user);
      } else {
        return sendText(from, '⚠️ Invalid date format.');
      }
    } catch (err) {
      console.error('❌ awaitTodoClosingDate error:', err);
      await sendText(from, '⚠️ Error. Please try again.');
    }
  },

  awaitCustomClosingDate: async (from, user, msgObj, text) => {
    try {
      // Validate custom date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(text)) {
        const customDate = new Date(text);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Validate that the custom date is not in the past
        if (customDate < today) {
          return sendText(from, '⚠️ Date cannot be in the past. Please enter a future date (YYYY-MM-DD):');
        }
        
        user.todoData.expected_closing_date = customDate.toISOString();
        // Now save the complete todo item
        await steps.saveTodoItem(from, user);
      } else {
        return sendText(from, '⚠️ Invalid date format. Please use YYYY-MM-DD format:');
      }
    } catch (err) {
      console.error('❌ awaitCustomClosingDate error:', err);
      await sendText(from, '⚠️ Error. Please try again.');
    }
  },

  saveTodoItem: async (from, user) => {
    try {
      // Prepare data for Supabase 'todo' table
      const todoData = {
        user_id: user.feedback.user_id,
        action_item: user.todoData.action_item,
        notes: user.todoData.notes || null,
        open_date: user.todoData.open_date || null,
        expected_closing_date: user.todoData.expected_closing_date || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      const { data: saved, error } = await supabase
        .from('todo')
        .insert([todoData])
        .select()
        .single();

      if (error) {
        console.error('❌ Error saving todo:', error);
        await sendText(from, '⚠️ Error saving todo item. Please try again.');
        return;
      }

      console.log('✅ Todo item saved:', saved);
      await sendText(from, `✅ Todo added: *${user.todoData.action_item}*`);
      
      user.step = 'awaitMainMenuChoice';
      await sendText(from, '\n\nWhat would you like to do next?');
      await sendList(from, 'Main Menu', 'Choose an option:', [
        { id: 'report_snag', title: 'Report a Snag' },
        { id: 'view_snags', title: 'View My Snags' },
        { id: 'add_todo', title: 'Add to Todo List' },
        { id: 'view_todos', title: 'View Pending Todos' },
        { id: 'update_todo', title: 'Mark Todo Complete' },
      ]);
      
      // Clear todo data
      delete user.todoData;
    } catch (err) {
      console.error('❌ saveTodoItem error:', err);
      await sendText(from, '⚠️ Error saving todo item. Please try again.');
    }
  },

  askSite: async (from, user, msgObj, text) => {
    // Query Supabase for site (case-insensitive)
    const { data: siteData, error } = await supabase
      .from('site')
      .select('id, site_name')
      .ilike('site_name', text)
      .single();
    
    if (error || !siteData) {
      return sendText(from, `⚠️ Site "${text}" not found. Try again.`);
    }

    user.feedback.site_id = siteData.id;
    user.feedback.sitename = siteData.site_name;
    user.feedback.code = 'skipped'; // Passphrase check skipped
    await sendText(from, `✅ Site verified: *${siteData.site_name}*`);
    await steps.askCategory(from, user);
  },

  // Passphrase check skipped - moved directly to category after site selection

  askCategory: async (from, user) => {
    const categories = [
      { id: 'safety_compliance', title: 'Safety & Compliance' },
      { id: 'design_conflicts', title: 'Design' },
      { id: 'resource_blockers', title: 'Resources' },
      { id: 'workflow_issues', title: 'Workflow' },
      { id: 'miscellaneous', title: 'Other' },
    ];
    await sendList(from, 'Category', 'Select issue category:', categories);
    user.step = 'awaitCategory';
  },

  awaitCategory: async (from, user, msgObj, text) => {
    user.feedback.category = text;
    user.step = 'chooseFeedbackType';
    await sendList(from, 'Feedback Type', 'Choose how to give feedback:', [
      { id: 'voice', title: '🎙️ Voice' },
      { id: 'text', title: '✍️ Text' },
    ]);
  },

  chooseFeedbackType: async (from, user, msgObj, text) => {
    if (text === 'voice') {
      user.feedback.feedback_type = 'voice';
      user.step = 'awaitVoice';
      return sendText(from, '🎤 Please record and send your voice note.');
    }
    if (text === 'text') {
      user.feedback.feedback_type = 'text';
      user.step = 'awaitTextFeedback';
      return sendText(from, '✍️ Please type your feedback:');
    }
  },

  awaitVoice: async (from, user, msgObj) => {
    const mediaId = msgObj.audio?.id || msgObj.voice?.id || msgObj.audio_message?.id;
    if (!mediaId) return sendText(from, '⚠️ No audio found. Please resend.');

    const localPath = await downloadMedia(mediaId, 'voice', user.feedback.reporter_name || 'user');
    if (!localPath) {
      return sendText(from, '⚠️ Error uploading voice file to S3. Please try again.');
    }

    user.feedback.voice_url = localPath;
    
    // Transcribe the voice message
    console.log('🎤 Starting transcription process...');
    await sendText(from, '🔄 Processing your voice message...');
    const transcription = await getTranscription(localPath);
    
    if (transcription) {
      user.feedback.transcription = transcription;
      console.log('✅ Transcription stored:', transcription.substring(0, 100));
    } else {
      console.warn('⚠️ Transcription failed, but continuing with voice file.');
      // Continue even if transcription fails
    }

    user.step = 'askImage';
    await sendList(from, 'Upload Image', 'Would you like to attach an image?', [
      { id: 'yes', title: 'Yes' },
      { id: 'no', title: 'No' },
    ]);
  },

  awaitTextFeedback: async (from, user, msgObj, text) => {
    user.feedback.feedback = text;
    user.step = 'askSolution';
    await sendText(from, 'Do you have a suggested solution? Type it or "no".');
  },

  askSolution: async (from, user, msgObj, text) => {
    user.feedback.solution = text.toLowerCase() === 'no' ? null : text;
    user.step = 'askImage';
    await sendList(from, 'Upload Image', 'Would you like to attach an image?', [
      { id: 'yes', title: 'Yes' },
      { id: 'no', title: 'No' },
    ]);
  },

  askImage: async (from, user, msgObj, text) => {
    if (text === 'yes') {
      user.step = 'awaitImage';
      return sendText(from, '📸 Please send your image now.');
    }
    if (text === 'no') {
      user.step = 'saveFeedback';
      return steps.saveFeedback(from, user);
    }
  },

  awaitImage: async (from, user, msgObj) => {
    const mediaId = msgObj.image?.id;
    if (!mediaId) return sendText(from, '⚠️ No image found. Please resend.');
    
    const s3Key = await downloadMedia(mediaId, 'images', user.feedback.reporter_name || 'user');
    if (!s3Key) {
      return sendText(from, '⚠️ Error uploading image to S3. Please try again.');
    }
    
    user.feedback.image = [s3Key];
    user.step = 'saveFeedback';
    await steps.saveFeedback(from, user);
  },

// 🧾 SAVE FEEDBACK TO SUPABASE
saveFeedback: async (from, user) => {
  try {
    // Extract phone number (remove +, keep only digits)
    const phoneNumber = from.replace(/\D/g, '');

    // Prepare data object for Supabase 'snag' table
    const feedbackData = {
      phone_number: parseInt(phoneNumber),
      reporter_name: user.feedback.reporter_name,
      site_id: user.feedback.site_id,
      category: user.feedback.category,
      feedback_type: user.feedback.feedback_type,
      feedback: user.feedback.feedback || null,
      voice_url: user.feedback.voice_url || null,
      transcription: user.feedback.transcription || null,
      suggestion: user.feedback.solution || null,
      image_url: user.feedback.image?.[0] || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Insert into Supabase 'snag' table
    const { data: saved, error } = await supabase
      .from('snag')
      .insert([feedbackData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving to Supabase:', error);
      await sendText(from, '⚠️ Error saving feedback. Please try again later.');
      return;
    }

    console.log('\n📝 Feedback Saved to Supabase:', saved);

    // --- Define Report Paths (for CSV reporting) ---
    const { REPORTS_DIR, DAYWISE_CSV, SITEWISE_CSV } = require('../config/paths');
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

    // --- Extract Required Fields ---
    const createdAtISO = saved.created_at;
    const today = createdAtISO.split('T')[0];
    const { sitename, category } = user.feedback;
    const feedbackId = saved.id.toString();

    // --- Get Site Name (for reporting) ---
    const { data: siteData } = await supabase
      .from('site')
      .select('site_name')
      .eq('id', saved.site_id)
      .single();

    const siteCode = 'N/A'; // Not available in current schema
    const siteName = siteData?.site_name || sitename;

    // ====================================================
    // 1️⃣ APPEND TO DAYWISE CSV
    // ====================================================
    const dayHeaders = [
      'feedback_id',
      'createdAt',
      'date',
      'site code',
      'name',
      'category',
      'resolved',
      'resolvedAt',
      'time_to_resolve_hrs',
    ];

    // Ensure CSV file exists with headers
    if (!fs.existsSync(DAYWISE_CSV)) {
      fs.writeFileSync(DAYWISE_CSV, dayHeaders.join(',') + '\n', 'utf8');
    }

    // --- Build new row ---
    const newDayRow = [
      feedbackId,
      createdAtISO,
      today,
      siteCode,
      siteName,
      category,
      'No',
      '',
      '',
    ].join(',');

    // Append to CSV
    try {
      let needsNewline = true;
      const stats = fs.statSync(DAYWISE_CSV);
      if (stats.size > 0) {
        const fd = fs.openSync(DAYWISE_CSV, 'r');
        const buffer = Buffer.alloc(1);
        fs.readSync(fd, buffer, 0, 1, stats.size - 1);
        fs.closeSync(fd);
        if (buffer.toString() === '\n') needsNewline = false;
      }
      fs.appendFileSync(DAYWISE_CSV, (needsNewline ? '\n' : '') + newDayRow + '\n', 'utf8');
    } catch (err) {
      fs.appendFileSync(DAYWISE_CSV, newDayRow + '\n', 'utf8');
    }

    console.log('✅ Daywise CSV appended successfully.');

    // --- Send confirmation ---
    await sendText(from, '🙏 Thank you! Your feedback has been saved successfully.');

    delete userStates[from];
  } catch (err) {
    console.error('❌ saveFeedback error:', err);
    await sendText(from, '⚠️ Error saving feedback. Please try again later.');
  }
}

};

// -------------------- Main Webhook --------------------
exports.receiveWhatsAppMessage = async (req, res) => {
  try {
    console.log('📩 Incoming Payload:', JSON.stringify(req.body, null, 2));
    res.sendStatus(200);

    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msgObj = entry?.messages?.[0];
    if (!msgObj) return;

    const msgId = msgObj.id;
    const from = msgObj.from;
    const msgType = msgObj.type;
    let text = msgObj.text?.body?.trim();

    if (msgType === 'interactive' && msgObj.interactive?.type === 'list_reply') {
      text = msgObj.interactive.list_reply.id;
    }

    if (!msgId) {
      console.log('⚠️ Missing msgId — skipping.');
      return;
    }

    if (processedMessages.has(msgId)) return;
    processedMessages.add(msgId);
    setTimeout(() => processedMessages.delete(msgId), 2 * 60 * 1000);

    if (!userStates[from]) userStates[from] = { step: null, feedback: {}, registeredUser: null };
    const user = userStates[from];

    // 🔄 RESTART CONVERSATION - Check if user wants to restart at ANY point
    const restartKeywords = ['hi', 'hey', 'hello'];
    if (restartKeywords.includes(text?.toLowerCase())) {
      // Reset user state
      delete userStates[from];
      userStates[from] = { step: null, feedback: {}, registeredUser: null };
      const freshUser = userStates[from];
      
      // 🔍 Check if user exists in website_user table
      const registeredUser = await getUserByPhoneNumber(from);
      
      if (registeredUser) {
        // ✅ User found - greet with name and show main menu
        freshUser.registeredUser = registeredUser;
        freshUser.feedback.reporter_name = registeredUser.username;
        freshUser.feedback.user_id = registeredUser.user_id;
        freshUser.step = 'awaitMainMenuChoice';
        
        console.log(`👋 Greeting registered user: ${registeredUser.username}`);
        await sendText(from, `👋 Welcome back, *${registeredUser.username}*! 🎉`);
        
        // Show main menu options
        await sendList(from, 'Main Menu', 'What would you like to do?', [
          { id: 'report_snag', title: 'Report a Snag' },
          { id: 'view_snags', title: 'View My Snags' },
          { id: 'add_todo', title: 'Add to Todo List' },
          { id: 'view_todos', title: 'View Pending Todos' },
          { id: 'update_todo', title: 'Mark Todo Complete' },
        ]);
      } else {
        // ❌ User not registered - ask for name
        freshUser.step = 'askName';
        await sendText(from, '👋 Hi! Please enter your *name* to start:');
      }
      return;
    }

    if (!user.step) return sendText(from, '⚠️ Please type "Hi" to start.');

    const stepHandler = steps[user.step];
    if (stepHandler) await stepHandler(from, user, msgObj, text);
    else {
      await sendText(from, '⚠️ Restarting flow. Please type "Hi".');
      delete userStates[from];
    }
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
  }
};
