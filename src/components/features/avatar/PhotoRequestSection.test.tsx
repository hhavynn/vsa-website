import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoRequestSection } from './PhotoRequestSection';
import { ValidationError } from '../../../data/errors';

const mockSubmit = jest.fn();
jest.mock('../../../data/repos/photoRequests', () => ({
  photoRequestsRepository: { submitPhotoRequest: (...args: unknown[]) => mockSubmit(...args) },
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

const MEMBER_ID = '00000000-0000-4000-8000-000000000001';

function openForm() {
  render(<PhotoRequestSection matchedMemberId={MEMBER_ID} selectedMemberName="Synthetic Member" />);
  fireEvent.click(screen.getByRole('button', { name: /request photo/i }));
  const dialog = screen.getByRole('dialog');
  return {
    dialog,
    name: screen.getByLabelText('Your name') as HTMLInputElement,
    email: screen.getByLabelText('UCSD Email') as HTMLInputElement,
    photo: screen.getByLabelText('Photo') as HTMLInputElement,
    submit: screen.getByRole('button', { name: /submit for review/i }),
  };
}

const photo = (type = 'image/webp', name = 'me.webp') => new File(['bytes'], name, { type });

beforeEach(() => jest.clearAllMocks());

describe('PhotoRequestSection', () => {
  it('names every field that blocks the request instead of failing silently', async () => {
    const { submit } = openForm();
    fireEvent.click(submit);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/hasn't been submitted/i);
    expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose a photo to upload/i)).toBeInTheDocument();
    expect(screen.getByText(/You must confirm consent/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('rejects a non-UCSD email beside the field', async () => {
    const { name, email, photo: fileInput, submit } = openForm();
    await userEvent.type(name, 'Synthetic Member');
    await userEvent.type(email, 'synthetic@gmail.com');
    await userEvent.upload(fileInput, photo());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submit);

    expect(await screen.findByText(/must end in @ucsd\.edu/i)).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('flags an unsupported photo type as soon as it is chosen', async () => {
    const { photo: fileInput } = openForm();
    fireEvent.change(fileInput, { target: { files: [photo('image/heic', 'IMG_1.heic')] } });
    expect(await screen.findByText(/isn't a supported photo type/i)).toBeInTheDocument();
  });

  it('flags an oversized photo as soon as it is chosen', async () => {
    const { photo: fileInput } = openForm();
    const big = photo();
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [big] } });
    expect(await screen.findByText(/Choose one under 5 MB/i)).toBeInTheDocument();
  });

  it('shows the reason a submission was refused, and keeps the form open', async () => {
    mockSubmit.mockRejectedValue(
      new ValidationError('Photo request limit reached. Please contact VSA or try again later.'),
    );
    const { dialog, name, email, photo: fileInput, submit } = openForm();
    await userEvent.type(name, 'Synthetic Member');
    await userEvent.type(email, 'synthetic@ucsd.edu');
    await userEvent.upload(fileInput, photo());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your request wasn't submitted. Photo request limit reached. Please contact VSA or try again later.",
    );
    expect(dialog).toBeInTheDocument();
    expect(submit).not.toBeDisabled();
  });

  it('submits a valid request and confirms it', async () => {
    mockSubmit.mockResolvedValue(undefined);
    const { name, email, photo: fileInput, submit } = openForm();
    await userEvent.type(name, 'Synthetic Member');
    await userEvent.type(email, 'synthetic@ucsd.edu');
    await userEvent.upload(fileInput, photo());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submit);

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Request submitted/i)).toBeInTheDocument();
  });
});
