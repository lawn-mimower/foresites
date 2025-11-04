const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  phone: String,
  name: String,
  sitename: String,
  code: String,
  
  // Category chosen by user
  category: {
    type: String,
    enum: [
      "safety_compliance",
      "design_conflicts",
      "resource_blockers",
      "workflow_issues",
      "miscellaneous"
    ]
  },

  // Feedback can be text or voice
  feedback_type: { type: String, enum: ['text', 'voice'], default: 'text' },
  feedback: String,             // text feedback
  voice_url: String,            

  solution: String,             // user's suggested solution if any
  image: [String],             

  suggestions: String,          // optional future field
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserFeedback', feedbackSchema);
