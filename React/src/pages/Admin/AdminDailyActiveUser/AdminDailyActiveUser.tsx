import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Filter,
  User,
  Activity
} from 'lucide-react';
import api from '../../../services/api';
import './AdminDailyActiveUser.css';

// TypeScript interfaces
interface QuestionActivity {
  question_id: number;
  question_text: string;
  time_spent: number; // in seconds
  attempts: number;
  completed: boolean;
  session_title: string;
  timestamp: string;
}

interface UserActivityData {
  user_id: number;
  user_name: string;
  email: string;
  date: string;
  total_time_spent: number; // in seconds
  total_questions: number;
  completed_questions: number;
  average_time_per_question: number;
  activities: QuestionActivity[];
}

interface DailyStats {
  total_active_time: string;
  questions_answered: number;
  avg_time_per_question: string;
  completion_rate: number;
}

const AdminDailyActiveUser: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [userActivityData, setUserActivityData] = useState<UserActivityData[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());

  const fetchActivityData = async () => {

    try {

        const response = await api.get(
            `/daily-activity?date=${selectedDate}`
        );

        if (response.data.success) {

            setUserActivityData(response.data.data);

        }

    } catch (error) {

        console.error(error);

    }

};
useEffect(() => {

    fetchActivityData();

}, [selectedDate]);
 


  // Format time from seconds to readable format
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Calculate daily stats
  const calculateDailyStats = (): DailyStats => {
    const filteredData = selectedUser === 'all' 
      ? userActivityData 
      : userActivityData.filter(user => user.user_id.toString() === selectedUser);

    const totalTime = filteredData.reduce((sum, user) => sum + user.total_time_spent, 0);
    const totalQuestions = filteredData.reduce((sum, user) => sum + user.total_questions, 0);
    const completedQuestions = filteredData.reduce((sum, user) => sum + user.completed_questions, 0);
    const avgTime = totalQuestions > 0 ? totalTime / totalQuestions : 0;

    return {
      total_active_time: formatTime(totalTime),
      questions_answered: totalQuestions,
      avg_time_per_question: formatTime(Math.round(avgTime)),
      completion_rate: totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0
    };
  };

  const stats = calculateDailyStats();

  const toggleUserExpansion = (userId: number) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

 

  const getTimeCategory = (seconds: number): string => {
    if (seconds < 60) return 'quick';
    if (seconds < 300) return 'normal';
    return 'extended';
  };

  const filteredUsers = selectedUser === 'all' 
    ? userActivityData 
    : userActivityData.filter(user => user.user_id.toString() === selectedUser);

  return (
    <div className="daily-activity-page">
      <div className="activity-container">
        {/* Header */}
        <div className="activity-header">
          <div className="header-left">
            <h1 className="page-title">
              <Activity size={32} />
              Daily User Activity
            </h1>
            <p className="page-subtitle">Track time spent per question and user engagement</p>
          </div>
          
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="date-filter">
              <Calendar size={18} />
              Date
            </label>
            <input
              id="date-filter"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="user-filter">
              <Filter size={18} />
              User
            </label>
            <select
              id="user-filter"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="user-select"
            >
              <option value="all">All Users</option>
              {userActivityData.map((user) => (
                <option key={user.user_id} value={user.user_id.toString()}>
                  {user.user_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Total Active Time</p>
              <h3 className="stat-value">{stats.total_active_time}</h3>
            </div>
          </div>

         

         
    

         
        </div>

        {/* User Activity List */}
        <div className="activity-list-section">
          <h2 className="section-title">User Activity Details</h2>

          {filteredUsers.length === 0 ? (
            <div className="no-data">
              <Activity size={48} />
              <p>No activity data available for selected date</p>
            </div>
          ) : (
            <div className="users-list">
              {filteredUsers.map((user) => (
                <div key={user.user_id} className="user-activity-card">
                  {/* User Header */}
                  <div 
                    className="user-header"
                    onClick={() => toggleUserExpansion(user.user_id)}
                  >
                    <div className="user-info">
                      <div className="user-avatar">
                        <User size={24} />
                      </div>
                      <div className="user-details">
                        <h3 className="user-name">{user.user_name}</h3>
                        <p className="user-email">{user.email}</p>
                      </div>
                    </div>

                    <div className="user-summary">
                      <div className="summary-item">
                        <span className="summary-label">Total Time</span>
                        <span className="summary-value">{formatTime(user.total_time_spent)}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Questions</span>
                        <span className="summary-value">{user.completed_questions}/{user.total_questions}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Avg Time</span>
                        <span className="summary-value">{formatTime(user.average_time_per_question)}</span>
                      </div>
                      <div className={`expand-icon ${expandedUsers.has(user.user_id) ? 'expanded' : ''}`}>
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Question Activities */}
                  {expandedUsers.has(user.user_id) && (
                    <div className="questions-list">
                      <div className="questions-header">
                        <span>Question</span>
                        <span style={{marginLeft:'20px'}}>Session</span>
                        
                       
                      </div>
                      {user.activities.map((activity, index) => (
                        <div key={activity.question_id} className="question-item">
                          <div className="question-number">Q{index + 1}</div>
                          <div className="question-details">
                            <p className="question-text" title={activity.question_text}>
                              {activity.question_text}
                            </p>
                            <span className="question-session">{activity.session_title}</span>
                          </div>
                          <div className="question-session-mobile">{activity.session_title}</div>
                          <div className={`question-time ${getTimeCategory(activity.time_spent)}`}>
                            <Clock size={16} />
                            {formatTime(activity.time_spent)}
                          </div>
                         
                        
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDailyActiveUser;
