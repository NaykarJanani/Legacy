import React, { useState } from 'react';
import './AdminSessionManagementRegister.css';
import { toast } from 'react-toastify';
import api from '../../../services/api';
import { useLoader } from '../../../context/LoaderContext';
import { useNavigate , useLocation } from 'react-router-dom';

interface SubPoint {
  id: string;
  title: string;
}

interface SubChapter {
  id: string;
  title: string;
  subPoints: SubPoint[];
}

interface MainPoint {
  id: string;
  title: string;
  subChapters: SubChapter[];
}

interface FormData {
  sessionName: string;
  category: string;
  mainPoints: MainPoint[];
}

const AdminSessionManagementRegister: React.FC = () => {
 const [formData, setFormData] = useState<FormData>({
  sessionName: '',
  category: 'msme',
  mainPoints: [],
});
  const { showLoader, hideLoader } = useLoader();
  const navigate = useNavigate();

  // Generate unique IDs
  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add Main Point
  const addMainPoint = () => {
  const newMainPoint: MainPoint = {
    id: generateId(),
    title: '',
    subChapters: [],
  };

  setFormData({
    ...formData,
    mainPoints: [...formData.mainPoints, newMainPoint],
  });
};

  // Remove Main Point
  const removeMainPoint = (mainPointId: string) => {
    setFormData({
      ...formData,
      mainPoints: formData.mainPoints.filter((mp) => mp.id !== mainPointId),
    });
  };

  // Update Main Point Title
  const updateMainPointTitle = (mainPointId: string, title: string) => {
    setFormData({
      ...formData,
      mainPoints: formData.mainPoints.map((mp) =>
        mp.id === mainPointId ? { ...mp, title } : mp
      ),
    });
  };

  // Add Sub Point
  const addSubChapter = (mainId: string) => {
    setFormData(prev => ({
      ...prev,
      mainPoints: prev.mainPoints.map(mp =>
        mp.id === mainId
          ? { ...mp, subChapters: [...mp.subChapters, { id: generateId(), title: '', subPoints: [] }] }
          : mp
      ),
    }));
  };

  const removeSubChapter = (mainId: string, subChapterId: string) => {
    setFormData(prev => ({
      ...prev,
      mainPoints: prev.mainPoints.map(mp =>
        mp.id === mainId
          ? { ...mp, subChapters: mp.subChapters.filter(sc => sc.id !== subChapterId) }
          : mp
      ),
    }));
  };

  const updateSubChapterTitle = (mainId: string, subChapterId: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      mainPoints: prev.mainPoints.map(mp =>
        mp.id === mainId
          ? { ...mp, subChapters: mp.subChapters.map(sc => sc.id === subChapterId ? { ...sc, title } : sc) }
          : mp
      ),
    }));
  };

  const addSubPoint = (mainId: string, subChapterId: string) => {
    setFormData(prev => ({
      ...prev,
      mainPoints: prev.mainPoints.map(mp =>
        mp.id === mainId
          ? {
              ...mp,
              subChapters: mp.subChapters.map(sc =>
                sc.id === subChapterId
                  ? { ...sc, subPoints: [...sc.subPoints, { id: generateId(), title: '' }] }
                  : sc
              ),
            }
          : mp
      ),
    }));
  };

  const removeSubPoint = (mainId: string, subChapterId: string, subPointId: string) => {
    setFormData(prev => ({
      ...prev,
      mainPoints: prev.mainPoints.map(mp =>
        mp.id === mainId
          ? {
              ...mp,
              subChapters: mp.subChapters.map(sc =>
                sc.id === subChapterId
                  ? { ...sc, subPoints: sc.subPoints.filter(sp => sp.id !== subPointId) }
                  : sc
              ),
            }
          : mp
      ),
    }));
  };

  const updateSubPointTitle = (mainId: string, subChapterId: string, subPointId: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      mainPoints: prev.mainPoints.map(mp =>
        mp.id === mainId
          ? {
              ...mp,
              subChapters: mp.subChapters.map(sc =>
                sc.id === subChapterId
                  ? { ...sc, subPoints: sc.subPoints.map(sp => sp.id === subPointId ? { ...sp, title } : sp) }
                  : sc
              ),
            }
          : mp
      ),
    }));
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try{
        showLoader();
     await api.post('/addSession', {
  sessions: [{
    sessionName: formData.sessionName,
    category: formData.category,
    mainPoints: formData.mainPoints
  }]
});
        
        toast.success('Session Added');
        navigate("/Admin/SessionManagement")
    }catch (err: any) {
          toast.error(err.response?.data?.message || "Something went wrong");
        } finally {
          hideLoader();
        }    
    
  };

  // Handle Reset
  const handleReset = () => {
  setFormData({
    sessionName: '',
    category: 'msme',
    mainPoints: [],
  });
};

  return (
    <div className="session-add-container">
      <h1 className="form-title">Session Add</h1>

      <form onSubmit={handleSubmit} className="session-form">
        {/* Session Name */}
        <div className="form-group">
          <label htmlFor="sessionName" className="form-label">
            Session Title <span className="required">*</span>
          </label>
          <input
            type="text"
            id="sessionName"
            className="form-input"
            value={formData.sessionName}
            onChange={(e) =>
              setFormData({ ...formData, sessionName: e.target.value })
            }
            placeholder="Enter session name"
            required
          />
        </div>
        <div className="form-group">
  <label className="form-label">
    Category <span className="required">*</span>
  </label>

  <select
    className="form-input"
    value={formData.category}
    onChange={(e) =>
      setFormData({
        ...formData,
        category: e.target.value
      })
    }
  >
    <option value="msme">MSME</option>
    <option value="school">School</option>
    <option value="temple">Temple</option>
    <option value="village">Village</option>
  </select>
</div>

        {/* Main Points Section */}
<div className="main-points-section">
          <div className="section-header">
            <h2 className="section-title">Chapters</h2>
            <button type="button" className="btn btn-primary" onClick={addMainPoint}>
              + Add Chapter
            </button>
          </div>

          {formData.mainPoints.map((mainPoint, mIdx) => (
            <div key={mainPoint.id} className="main-point-card">
              <div className="card-header">
                <span className="point-number">Chapter {mIdx + 1}</span>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeMainPoint(mainPoint.id)}>
                  ✕ Remove
                </button>
              </div>
              <div className="form-group">
                <input
                  type="text"
                  className="form-input mt-2"
                  value={mainPoint.title}
                  onChange={e => updateMainPointTitle(mainPoint.id, e.target.value)}
                  placeholder="e.g. The Human Behind the Institution"
                  required
                />
              </div>

              <div className="sub-chapters-section">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSubChapter(mainPoint.id)}>
                  + Add Sub Chapter
                </button>

                {mainPoint.subChapters.map((subChapter, scIdx) => (
                  <div key={subChapter.id} className="subchapter-card">
                    <div className="card-header">
                      <span className="point-number">Sub Chapter {scIdx + 1}</span>
                      <button type="button" className="btn btn-danger btn-xs" onClick={() => removeSubChapter(mainPoint.id, subChapter.id)}>
                        ✕
                      </button>
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        className="form-input mt-2"
                        value={subChapter.title}
                        onChange={e => updateSubChapterTitle(mainPoint.id, subChapter.id, e.target.value)}
                        placeholder="e.g. Personal Identity"
                        required
                      />
                    </div>

                    <div className="sub-points-section">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSubPoint(mainPoint.id, subChapter.id)}>
                        + Add Question
                      </button>

                      {subChapter.subPoints.map((subPoint, spIdx) => (
                        <div key={subPoint.id} className="sub-point-card">
                          <div className="card-header">
                            <span className="point-number">Question {spIdx + 1}</span>
                            <button type="button" className="btn btn-danger btn-xs" onClick={() => removeSubPoint(mainPoint.id, subChapter.id, subPoint.id)}>
                              ✕
                            </button>
                          </div>
                          <div className="form-group">
                            <input
                              type="text"
                              className="form-input form-input-sm"
                              value={subPoint.title}
                              onChange={e => updateSubPointTitle(mainPoint.id, subChapter.id, subPoint.id, e.target.value)}
                              placeholder="Enter question"
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-success">Submit Session</button>
          <button type="button" className="btn btn-outline" onClick={handleReset}>Reset Form</button>
        </div>
      </form>
    </div>
  );
};

export default AdminSessionManagementRegister;
