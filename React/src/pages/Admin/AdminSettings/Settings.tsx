
import React, { useEffect, useState } from 'react';
import './Settings.css';
import api from '../../../services/api';
import { toast } from 'react-toastify';

const Settings = () => {

    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
    admin_id: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
});

    // GET PROFILE
    const getAdminProfile = async () => {

        try {

            const response = await api.get('/profile');

            const data = response.data.data;

            setFormData(prev => ({
                ...prev,
                admin_id: data.admin_id || '',
                fullName: data.name || '',
                email: data.email || '',
                phone: data.phone || '',
            }));

        } catch (error) {

            console.error(error);
            toast.error('Failed to fetch profile');

        }

    };

    useEffect(() => {

        getAdminProfile();

    }, []);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {

        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });

    };

    // UPDATE PROFILE
    const handleSave = async () => {

        try {

            if (
                formData.password &&
                formData.password !== formData.confirmPassword
            ) {

                toast.error('Passwords do not match');
                return;

            }

            setLoading(true);

            await api.put('/update-profile', {
                name: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
            });

            toast.success('Profile Updated Successfully');

            setFormData(prev => ({
                ...prev,
                password: '',
                confirmPassword: '',
            }));

        } catch (error) {

            console.error(error);
            toast.error('Failed to update profile');

        } finally {

            setLoading(false);

        }

    };

    return (
        <div className="settings-page">

            <div className="settings-card">

                <div className="settings-header">

                    <div className="profile-avatar">
                        {formData.fullName?.charAt(0)}
                    </div>

                    <div>
                        <h1>Admin Settings</h1>
                        <p>Manage your profile information</p>
                    </div>

                </div>

                <div className="settings-form">

                    <div className="form-group">

                        <label>Full Name</label>

                        <input
                            type="text"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                        />

                    </div>

                    <div className="form-group">

                        <label>Email Address</label>

                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                        />

                    </div>

                    <div className="form-group">

                        <label>Phone Number</label>

                        <input
                            type="text"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                        />

                    </div>

                    <div className="form-group">

                        <label>New Password</label>

                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Enter new password"
                        />

                    </div>

                    <div className="form-group">

                        <label>Confirm Password</label>

                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Confirm password"
                        />

                    </div>

                    <button
                        className="save-btn"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>

                </div>

            </div>

        </div>
    );
};

export default Settings;
