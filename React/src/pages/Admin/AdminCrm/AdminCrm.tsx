import React, { useEffect, useState } from "react";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Button, Box, IconButton, TablePagination, TextField, Typography, InputAdornment,
    Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
    Alert, CircularProgress
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle, faSearch, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import api from "../../../services/api";
import { useSearchParams } from "react-router-dom";
import "./AdminCrm.css";

type CrmItem = {
    user_id: number;
    name: string;
    email: string;
    mobile: string;
    entityname: string;
};

type EditorItem = {
    user_id: number;
    name: string;
    email: string;
};

type CurrentEditor = {
    editor_id: number;
    name: string;
    email: string;
    assigned_at: string;
};

const AdminCrm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showLoader, hideLoader } = useLoader();

    const [crmList, setCrmList] = useState<CrmItem[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "msme"
);

    // ── assign-editor modal state ───────────────────────────────────────────
    const [editors, setEditors] = useState<EditorItem[]>([]);
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState<CrmItem | null>(null);
    const [selectedEditorId, setSelectedEditorId] = useState<string>("");
    const [assigning, setAssigning] = useState(false);
    const [currentEditor, setCurrentEditor] = useState<CurrentEditor | null>(null);
    const [checkingCurrentEditor, setCheckingCurrentEditor] = useState(false);

    // Fetch CRM list
    const getData = async () => {
        try {
            showLoader();
            const res = await api.get(`/crmList?category=${selectedCategory}`);

            if (res.data.success) {
                setCrmList(res.data.data);
            } else {
                toast.error(res?.data?.message || "Failed to fetch data");
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Something went wrong");
        } finally {
            hideLoader();
        }
    };

    useEffect(() => {
        getData();
    }, [selectedCategory]);

    // Fetch the list of editors once, to populate the assign dropdown
    const getEditors = async () => {
        try {
            const res = await api.get("/editorList");
            if (res.data.success) {
                setEditors(res.data.data);
            }
        } catch (err) {
            toast.error("Failed to load editors");
        }
    };

    const handleOpenAssign = (item: CrmItem) => {
        setAssignTarget(item);
        setSelectedEditorId("");
        setCurrentEditor(null);
        setAssignOpen(true);
        if (editors.length === 0) getEditors();
        checkCurrentEditor(item.user_id);
    };

    const handleCloseAssign = () => {
        setAssignOpen(false);
        setAssignTarget(null);
        setSelectedEditorId("");
        setCurrentEditor(null);
    };

    // Look up whether this customer already has an editor assigned,
    // so we can warn the admin before they pick a new one (avoids duplicates).
    const checkCurrentEditor = async (user_id: number) => {
        try {
            setCheckingCurrentEditor(true);
            const res = await api.get(`/customer/${user_id}/editor`);
            if (res.data.success) {
                setCurrentEditor(res.data.data ?? null);
            }
        } catch (err) {
            // Non-fatal — if the check fails, admin can still assign;
            // the backend still enforces one-editor-per-customer either way.
            setCurrentEditor(null);
        } finally {
            setCheckingCurrentEditor(false);
        }
    };

    const handleConfirmAssign = async () => {
        if (!assignTarget || !selectedEditorId) {
            toast.error("Please select an editor");
            return;
        }

        // Customer already has an editor — make sure the admin actually
        // means to replace it before we call the API.
        if (
            currentEditor &&
            String(currentEditor.editor_id) !== String(selectedEditorId)
        ) {
            const confirmed = window.confirm(
                `${assignTarget.name} is already assigned to ${currentEditor.name} (${currentEditor.email}). ` +
                `Assigning a new editor will replace this. Continue?`
            );
            if (!confirmed) return;
        }

        try {
            setAssigning(true);
            const res = await api.post("/editor/assign", {
                editor_id: selectedEditorId,
                user_id: assignTarget.user_id,
            });
            if (res.data.success) {
                toast.success(res.data.message || "Editor assigned successfully");
                handleCloseAssign();
            } else {
                toast.error(res.data.message || "Failed to assign editor");
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to assign editor");
        } finally {
            setAssigning(false);
        }
    };

    const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    useEffect(() => {
    const category = searchParams.get("category");

    if (category) {
        setSelectedCategory(category);
    }
}, [searchParams]); 
    const handleViewGallery = async (user_id: number) => {
    try {
        const res = await api.get(`/user/gallery/${user_id}`);

        if (res.data.success) {
            setSelectedFiles(res.data.data);
            setOpen(true);
        }
    } catch (err) {
        console.log(err);
        toast.error("Failed to load gallery");
    }
};
const handleNavigateToDetails = (item: CrmItem) => {
  navigate('Details', {
    state: { item }
  });
};
    // Filter logic
    const filteredData = crmList.filter((item) => {
        const lower = searchTerm.toLowerCase();
        return (
            item.name.toLowerCase().includes(lower) ||
            item.email.toLowerCase().includes(lower) ||
            item.mobile.toLowerCase().includes(lower) ||
            item.entityname.toLowerCase().includes(lower)
        );
    });

    const displayedData = filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Box sx={{ p: 2 }}>
            {/* Header Section */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 2,
                    mb: 2,
                }}
            >
                <Typography variant="h6" className="customerlistclass" sx={{ fontWeight: 600 }}>
                    <Box className="category-filter-wrapper">

    {["msme", "school", "temple", "village"].map((cat) => (

        <Button
    key={cat}
    className="category-filter-btn"
            variant={selectedCategory === cat ? "contained" : "outlined"}
            color="warning"
            onClick={() => setSelectedCategory(cat)}
            sx={{
                textTransform: "capitalize",
                borderRadius: 2
            }}
        >
            {cat}
        </Button>

    ))}

</Box>
                    CRM Customer List
                </Typography>

                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <TextField
                        size="small"
                        placeholder="Search by name, email, mobile..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(0);
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <FontAwesomeIcon icon={faSearch} style={{ color: "#888" }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            width: { xs: "100%", sm: 280 },
                            backgroundColor: "#fff",
                            borderRadius: 1,
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                            },
                        }}
                    />
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={() => navigate("Register")}
                        className="customerregisterclass"
                        sx={{ borderRadius: 2 }}
                    >
                        Register
                    </Button>
                </Box>
            </Box>

            {/* Table Section */}
            <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: "hidden" }}>
                <Table sx={{ minWidth: 750 }} aria-label="crm table">
                    <TableHead sx={{ backgroundColor: "#f7f9fc" }}>
                        <TableRow>
                            <TableCell align="center">Sr No</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell align="center">Email</TableCell>
                            <TableCell align="center">Mobile</TableCell>
                            <TableCell align="center">Entity Name</TableCell>
                            <TableCell align="center">Gallery</TableCell>
                            <TableCell align="center">Assign Editor</TableCell>
                            <TableCell align="center">Info</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {displayedData.length > 0 ? (
                            displayedData.map((item, idx) => ( 
                                <TableRow
                                    key={item.user_id}
                                    hover
                                    sx={{
                                        transition: "box-shadow 0.15s, background 0.15s",
                                        "&:hover": {
                                            backgroundColor: "#f9fcff",
                                            boxShadow: "0 2px 10px rgba(60,60,60,0.07)",
                                        },
                                    }}
                                >
                                    <TableCell className="p-0" align="center">
                                        {page * rowsPerPage + idx + 1}
                                    </TableCell>
                                    <TableCell className="p-0">{item.name}</TableCell>
                                    <TableCell className="p-0" align="center">{item.email}</TableCell>
                                    <TableCell className="p-0" align="center">{item.mobile}</TableCell>
                                    <TableCell className="p-0" align="center">{item.entityname}</TableCell>
                                    <TableCell align="center">
  <button
    onClick={() => handleViewGallery(item.user_id)}
    style={{
      padding: "6px 12px",
      background: "#e2e8f0",
      color: "#334155",
      border: "none",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: 600,
      cursor: "pointer"
    }}
  >
    View Files
  </button>
</TableCell>
                                    
                                    <TableCell align="center">
                                        <button
                                            onClick={() => handleOpenAssign(item)}
                                            style={{
                                                padding: "6px 12px",
                                                background: "#fef3c7",
                                                color: "#92400e",
                                                border: "none",
                                                borderRadius: "6px",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                cursor: "pointer"
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faUserPlus} style={{ marginRight: 6 }} />
                                            Assign Editor
                                        </button>
                                    </TableCell>

                                    <TableCell className="p-0" align="center">
                                        <IconButton 
                                            sx={{
                                                color: "#2d67b8",
                                                transition: "color 0.2s, transform 0.2s",
                                                "&:hover": {
                                                    color: "#3ba027",
                                                    transform: "scale(1.2) rotate(10deg)",
                                                },
                                            }}
                                            onClick={() => handleNavigateToDetails(item)}
                                        >
                                            <FontAwesomeIcon icon={faInfoCircle} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    No records found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 20]}
                    component="div"
                    count={filteredData.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </TableContainer>
            {open && (
    <div
        style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999
        }}
    >
        <div
            style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "10px",
                width: "500px",
                maxHeight: "80vh",
                overflowY: "auto"
            }}
        >
            <h3>User Gallery</h3>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginTop: "10px"
                }}
            >
                {selectedFiles.length > 0 ? (
                    selectedFiles.map((file, i) => (
                        <img
                            key={i}
                            src={`http://localhost:5002${file.file_url}`}
                            style={{
                                width: "100px",
                                height: "100px",
                                objectFit: "cover",
                                borderRadius: "8px"
                            }}
                        />
                    ))
                ) : (
                    <p>No Files Found</p>
                )}
            </div>

            <button
                onClick={() => setOpen(false)}
                style={{
                    marginTop: "15px",
                    padding: "6px 12px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px"
                }}
            >
                Close
            </button>
        </div>
    </div>
)}

            {/* Assign Editor Modal */}
            <Dialog open={assignOpen} onClose={handleCloseAssign} fullWidth maxWidth="xs">
                <DialogTitle>
                    Assign Editor{assignTarget ? ` — ${assignTarget.name}` : ""}
                </DialogTitle>
                <DialogContent>
                    {checkingCurrentEditor ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="body2" color="text.secondary">
                                Checking existing assignment...
                            </Typography>
                        </Box>
                    ) : currentEditor ? (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                            This customer is already assigned to <strong>{currentEditor.name}</strong> ({currentEditor.email}).
                            Picking a different editor below will replace this assignment.
                        </Alert>
                    ) : (
                        <Alert severity="success" sx={{ mt: 1 }}>
                            This customer has no editor assigned yet.
                        </Alert>
                    )}

                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel id="assign-editor-label">Select Editor</InputLabel>
                        <Select
                            labelId="assign-editor-label"
                            label="Select Editor"
                            value={selectedEditorId}
                            onChange={(e) => setSelectedEditorId(e.target.value as string)}
                        >
                            {editors.length === 0 ? (
                                <MenuItem value="" disabled>
                                    Loading editors...
                                </MenuItem>
                            ) : (
                                editors.map((editor) => (
                                    <MenuItem key={editor.user_id} value={editor.user_id}>
                                        {editor.name} ({editor.email})
                                        {currentEditor && String(currentEditor.editor_id) === String(editor.user_id)
                                            ? " — current"
                                            : ""}
                                    </MenuItem>
                                ))
                            )}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseAssign}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={handleConfirmAssign}
                        disabled={assigning || !selectedEditorId}
                    >
                        {assigning ? "Assigning..." : currentEditor ? "Reassign" : "Assign"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminCrm;