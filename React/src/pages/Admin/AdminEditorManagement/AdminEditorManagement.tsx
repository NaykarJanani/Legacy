import React, { useEffect, useState } from "react";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Button, Box, IconButton, TablePagination, TextField, Typography, InputAdornment, Switch
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle, faSearch } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import api from "../../../services/api";
import "./AdminEditorManagement.css";

interface Editor {
    id: number;
    name: string;
    address: string;
    email: string;
    status: boolean;
}

const AdminEditorManagement: React.FC = () => {
    const navigate = useNavigate();
    const { showLoader, hideLoader } = useLoader();

    const [editors, setEditors] = useState<Editor[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);

    // Fetch editor list
    const getData = async () => {
        try {
            showLoader();
            const res = await api.get("/editorList");

            if (res.data.success) {
                if (res.data.success) {
                    const formattedEditors = res.data.data.map((editor: any) => ({
                        ...editor,
                        status: typeof editor.status === "boolean" ? editor.status : false, // default OFF
                    }));
                    setEditors(formattedEditors);
                }

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
    }, []);

    const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Individual toggle
    const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
        showLoader();
        const res = await api.patch(`/editor/${id}/status`, {
            status: !currentStatus,
        });

        if (res.data.success) {
            setEditors((prev) =>
                prev.map((editor: any) =>
                    editor.user_id === id
                        ? { ...editor, status: !currentStatus }
                        : editor
                )
            );
            toast.success("Status updated successfully");
        } else {
            toast.error(res?.data?.message || "Failed to update status");
        }
    } catch (err: any) {
        toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
        hideLoader();
    }
};


    
    // Filter logic
    const filteredData = editors.filter((editor) => {
        const lower = searchTerm.toLowerCase();
        return (
            editor.name.toLowerCase().includes(lower) ||
            editor.email.toLowerCase().includes(lower) ||
            editor.address.toLowerCase().includes(lower)
        );
    });

    const displayedData = filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Box sx={{ p: 2 }}>
            {/* Header */}
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
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Editor Management
                </Typography>

                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <TextField
                        size="small"
                        placeholder="Search by name, email, or address..."
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
                        color="primary"
                        onClick={() => navigate("Register")}
                        sx={{ borderRadius: 2 }}
                    >
                        + Register
                    </Button>
                </Box>
            </Box>

            {/* Table */}
            <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: "hidden" }}>
                <Table sx={{ minWidth: 750 }} aria-label="editor management table">
                    <TableHead sx={{ backgroundColor: "#f7f9fc" }}>
                        <TableRow>
                            <TableCell align="center">Sr No</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell align="center">Address</TableCell>
                            <TableCell align="center">Email</TableCell>
                            <TableCell align="center">Info</TableCell>
                            <TableCell align="center">Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {displayedData.length > 0 ? (
                            displayedData.map((editor:any, idx) => (
                                <TableRow
                                    key={editor.id}
                                    hover
                                    sx={{
                                        transition: "box-shadow 0.15s, background 0.15s",
                                        "&:hover": {
                                            backgroundColor: "#f9fcff",
                                            boxShadow: "0 2px 10px rgba(60,60,60,0.07)",
                                        },
                                    }}
                                >
                                    <TableCell className="p-0" align="center">{page * rowsPerPage + idx + 1}</TableCell>
                                    <TableCell className="p-0">{editor.name}</TableCell>
                                    <TableCell className="p-0" align="center">{editor.address}</TableCell>
                                    <TableCell className="p-0" align="center">{editor.email}</TableCell>
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
                                            onClick={() => navigate("Details", { state: { editor } })}
                                        >
                                            <FontAwesomeIcon icon={faInfoCircle} />
                                        </IconButton>
                                    </TableCell>
                                    <TableCell align="center" className="p-0">
                                        <Switch
    checked={editor.status}
    onChange={() => handleToggleStatus(editor.user_id, editor.status)}
    color="success"
    inputProps={{ "aria-label": "status toggle" }}
/>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} align="center">
                                    No editors found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
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
        </Box>
    );
};

export default AdminEditorManagement;
