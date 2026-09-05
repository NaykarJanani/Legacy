import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import './AdminEditorDetails.css'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TablePagination,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import api from "../../../services/api";

const minusIcon = "https://cdn-icons-png.flaticon.com/512/992/992683.png";

interface EditorInfo {
  user_id: number;
  name: string;
  email: string;
  address?: string;
  mobile?: string;
}

interface AssignedCustomer {
  user_id: number;
  name: string;
  email: string;
  mobile: string;
  category?: string;
  industry?: string;
  entity_name?: string;
  account_status?: boolean;
  assigned_at?: string;
}

const AdminEditorDetails: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showLoader, hideLoader } = useLoader();

  // Editor is passed via navigate("Details", { state: { editor } }) from the list page
  const editorFromState = (location.state as any)?.editor;
  const editorId = editorFromState?.user_id ?? editorFromState?.id;

  const [editorInfo, setEditorInfo] = useState<EditorInfo | null>(
    editorFromState ?? null
  );
  const [customers, setCustomers] = useState<AssignedCustomer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const getData = async () => {
    if (!editorId) {
      toast.error("No editor selected");
      navigate(-1);
      return;
    }
    try {
      showLoader();
      const res = await api.get(`/editor/${editorId}/customers`);

      if (res.data.success) {
        setEditorInfo(res.data.data.editor);
        setCustomers(res.data.data.customers || []);
      } else {
        toast.error(res?.data?.message || "Failed to fetch assigned customers");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      hideLoader();
    }
  };

  useEffect(() => {
    getData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorId]);

  const handleRemove = async (customerId: number) => {
    if (!editorId) return;
    try {
      showLoader();
      const res = await api.delete("/editor/assign", {
        data: { editor_id: editorId, user_id: customerId },
      });

      if (res.data.success) {
        setCustomers((prev) => prev.filter((c) => c.user_id !== customerId));
        toast.success("Customer unassigned successfully");
      } else {
        toast.error(res?.data?.message || "Failed to unassign customer");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      hideLoader();
    }
  };

  // Filter customers by search term (searches name and mobile)
  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile?.includes(searchTerm)
  );

  // Pagination handlers
  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginated data
  const paginatedCustomers = filteredCustomers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <div className="AdminEditorDetails__container">
      {/* Editor Info Section */}
      <div className="AdminEditorDetails__editor-row">
        <div className="AdminEditorDetails__editor-icon">
          <img
            src="https://cdn-icons-png.flaticon.com/512/1946/1946429.png"
            alt="Editor"
          />
        </div>
        <div className="AdminEditorDetails__editor-details">
          <div>
            <span>Name:</span>
            {editorInfo?.name}
          </div>
          <div>
            <span>Email:</span>
            {editorInfo?.email}
          </div>
        </div>
        <div className="AdminEditorDetails__editor-details">
          <div>
            <span>Address:</span>
            {editorInfo?.address || "-"}
          </div>
          <div>
            <span>Contact No:</span>
            {editorInfo?.mobile || "-"}
          </div>
        </div>
      </div>

      {/* Search and Add */}
      <div className="d-flex justify-content-between p-2">
        <div className="AdminEditorDetails__customers-header">Customers</div>
        <div className="AdminEditorDetails__utility-row">
          <input
            className="AdminEditorDetails__search"
            placeholder="Search by name or contact"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="AdminEditorDetails__add-btn">
            <Plus size={20} strokeWidth={3} /> Add
          </button>
        </div>
      </div>

      {/* MUI Table with pagination */}
      <TableContainer component={Paper} className="AdminEditorDetails__table-scroll">
        <Table className="AdminEditorDetails__table" aria-label="customers table">
          <TableHead>
            <TableRow>
              <TableCell>SR NO</TableCell>
              <TableCell>NAME</TableCell>
              <TableCell>CONTACT NO</TableCell>
              <TableCell>ACCESS CONTROL</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedCustomers.map((c, idx) => (
              <TableRow key={c.user_id} className="AdminEditorDetails__row">
                <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.mobile}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    aria-label="remove"
                    onClick={() => handleRemove(c.user_id)}
                  >
                    <img
                      src={minusIcon}
                      alt="minus"
                      draggable={false}
                      style={{ width: 20, height: 20 }}
                    />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {paginatedCustomers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No records found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredCustomers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </div>
  );
};

export default AdminEditorDetails;