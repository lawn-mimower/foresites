const mongoose=require('mongoose');
const feedbackSchema = new mongoose.Schema({
  phone: String,
  name: String,
  sitename: String,
  code: String,
  feedback: String,
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
  solution: String,
  image: [String],
  suggestions: String,
  createdAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false }
});


module.exports=mongoose.model('UserFeedback',feedbackSchema);